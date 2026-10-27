// FIPE API proxy, shared by the Vite dev/preview servers and the Cloudflare
// Worker used in production. It keeps the subscription token on the server,
// only forwards the read-only routes the app uses, and caches answers: data
// of a given reference month never changes, so those are cached for a month.

export const upstreamBaseUrl = "https://fipe.parallelum.com.br/api/v2";

/** Minimal Cache API surface (Cloudflare's caches.default, or memory in dev). */
export interface ProxyCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface FipeProxyOptions {
  /** Subscription token sent upstream; never exposed to the browser. */
  token?: string;
  /**
   * Tokens tried in order (see proxyTokensFromEnv): one that hits its daily
   * limit (429) or is refused (401/403) gives way to the next, and the
   * anonymous access comes last. Takes precedence over `token`.
   */
  tokens?: string[];
  /** Origins allowed to call the proxy cross-origin; "*" allows any. */
  allowedOrigins?: string[];
  cache?: ProxyCache;
  fetch?: typeof fetch;
  /** Lets the runtime finish cache writes after the response (Worker ctx.waitUntil). */
  waitUntil?: (promise: Promise<unknown>) => void;
  timeoutMs?: number;
}

const vehicle = "(?:cars|motorcycles|trucks)";
const id = "\\d{1,6}";
const yearCode = "\\d{4,5}-\\d{1,2}";
const fipeCode = "\\d{6}-\\d";

// Every route the app and the crawler read; anything else is refused.
const allowedRoutes = [
  "/references",
  `/${vehicle}/brands`,
  `/${vehicle}/brands/${id}/models`,
  `/${vehicle}/brands/${id}/models/${id}/years`,
  `/${vehicle}/brands/${id}/models/${id}/years/${yearCode}`,
  `/${vehicle}/brands/${id}/years`,
  `/${vehicle}/brands/${id}/years/${yearCode}/models`,
  `/${vehicle}/${fipeCode}/years`,
  `/${vehicle}/${fipeCode}/years/${yearCode}`,
  `/${vehicle}/${fipeCode}/years/${yearCode}/history`,
].map((route) => new RegExp(`^${route}$`));

const day = 24 * 60 * 60;

/**
 * The proxy's keys from the environment: FIPE_PROXY_TOKEN, FIPE_TOKEN, then
 * FIPE_TOKEN<n> from the highest number down. The crawler uses the numbered
 * keys from the lowest up, so both only meet on a key near the end of its
 * daily quota.
 */
export function proxyTokensFromEnv(env: Record<string, unknown>): string[] {
  const numbered = Object.keys(env)
    .filter((name) => /^FIPE_TOKEN\d+$/.test(name))
    .sort((left, right) => Number(right.slice(10)) - Number(left.slice(10)));
  const tokens: string[] = [];
  for (const name of ["FIPE_PROXY_TOKEN", "FIPE_TOKEN", ...numbered]) {
    const value = env[name];
    const token = typeof value === "string" ? value.trim() : "";
    if (token && !tokens.includes(token)) tokens.push(token);
  }
  return tokens;
}

/** Seconds a successful answer may be cached. */
export function cacheSeconds(path: string, reference: string | null): number {
  // A new reference month appears once a month; refresh the list a few times a day.
  if (path === "/references") return 6 * 60 * 60;
  // Answers for an explicit reference month are immutable.
  if (reference) return 30 * day;
  // "Latest" changes when a new month is published.
  return 60 * 60;
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin) return {};
  const allowAny = allowed.includes("*");
  if (!allowAny && !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": allowAny ? "*" : origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function createFipeProxy(options: FipeProxyOptions = {}) {
  const {
    allowedOrigins = [],
    cache,
    timeoutMs = 15_000,
    waitUntil,
  } = options;
  const fetchImpl = options.fetch ?? fetch;
  // undefined = anonymous, always the last resort.
  const keys: (string | undefined)[] = [
    ...(options.tokens ?? (options.token ? [options.token] : [])),
    undefined,
  ];
  // Shared by every request: once a key is used up, the next ones skip it.
  let current = 0;

  /** `path` is relative to the proxy mount, e.g. "/cars/brands?reference=338". */
  return async function handle(
    request: Request,
    path: string,
    /** Per-request override of options.waitUntil (one Worker context per request). */
    call: { waitUntil?: (promise: Promise<unknown>) => void } = {},
  ): Promise<Response> {
    const cors = corsHeaders(request.headers.get("Origin"), allowedOrigins);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json(405, { error: "Método não permitido" }, { ...cors, Allow: "GET, HEAD, OPTIONS" });
    }

    const url = new URL(path, "http://proxy.local");
    const route = url.pathname.replace(/\/+$/, "") || "/";
    if (!allowedRoutes.some((pattern) => pattern.test(route))) {
      return json(404, { error: "Rota não permitida" }, cors);
    }
    const reference = url.searchParams.get("reference");
    if (reference !== null && !/^\d{1,4}$/.test(reference)) {
      return json(400, { error: "Referência inválida" }, cors);
    }

    // Only the reference parameter is forwarded, so the cache key is canonical.
    const upstreamUrl = `${upstreamBaseUrl}${route}${reference ? `?reference=${reference}` : ""}`;
    const cacheKey = new Request(upstreamUrl);
    const maxAge = cacheSeconds(route, reference);
    const responseHeaders = (hit: boolean) => ({
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      // Browsers keep answers for a day at most; the shared cache keeps them longer.
      "Cache-Control": `public, max-age=${Math.min(maxAge, day)}`,
      "X-Proxy-Cache": hit ? "HIT" : "MISS",
    });

    const cached = await cache?.match(cacheKey);
    if (cached) {
      return new Response(request.method === "HEAD" ? null : await cached.text(), {
        status: 200,
        headers: responseHeaders(true),
      });
    }

    let upstream: Response;
    for (;;) {
      const key = current;
      const token = keys[key];
      try {
        upstream = await fetchImpl(upstreamUrl, {
          headers: token ? { "X-Subscription-Token": token } : {},
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const timedOut = error instanceof Error && error.name === "TimeoutError";
        return json(timedOut ? 504 : 502, { error: "FIPE indisponível" }, cors);
      }
      const keyUsedUp = upstream.status === 429 || upstream.status === 401 || upstream.status === 403;
      if (!keyUsedUp || key >= keys.length - 1) break;
      // Another request may have moved on already.
      if (current === key) current = key + 1;
    }

    if (!upstream.ok) {
      // Errors are passed through (429 keeps its Retry-After) and never cached.
      const passthrough: Record<string, string> = { ...cors };
      const retryAfter = upstream.headers.get("Retry-After");
      if (retryAfter) passthrough["Retry-After"] = retryAfter;
      return json(upstream.status, { error: `FIPE respondeu ${upstream.status}` }, passthrough);
    }

    const body = await upstream.text();
    if (cache) {
      const write = cache.put(
        cacheKey,
        new Response(body, {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${maxAge}`,
          },
        }),
      );
      // The Worker finishes the write after responding; Node servers just wait.
      const finish = call.waitUntil ?? waitUntil;
      if (finish) finish(write);
      else await write;
    }
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: responseHeaders(false),
    });
  };
}

/** In-memory cache with expiry, for the dev and preview servers. */
export function createMemoryCache(now: () => number = Date.now): ProxyCache {
  const entries = new Map<string, { body: string; expires: number }>();
  return {
    async match(request) {
      const entry = entries.get(request.url);
      if (!entry) return undefined;
      if (entry.expires <= now()) {
        entries.delete(request.url);
        return undefined;
      }
      return new Response(entry.body, { headers: { "Content-Type": "application/json" } });
    },
    async put(request, response) {
      const maxAge = Number(
        /max-age=(\d+)/.exec(response.headers.get("Cache-Control") ?? "")?.[1] ?? 0,
      );
      if (maxAge > 0) {
        entries.set(request.url, { body: await response.text(), expires: now() + maxAge * 1000 });
      }
    },
  };
}
