import { describe, expect, it, vi } from "vitest";
import { cacheSeconds, createFipeProxy, createMemoryCache, proxyTokensFromEnv } from "./fipe-proxy.ts";

function upstream(status = 200, body: unknown = [{ code: "21", name: "Fiat" }], headers = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;
}

const get = (path: string, headers: Record<string, string> = {}, method = "GET") =>
  new Request(`http://localhost/api/fipe${path}`, { method, headers });

describe("createFipeProxy", () => {
  it("forwards allowed routes with the token and only the reference parameter", async () => {
    const fetch = upstream();
    const handle = createFipeProxy({ token: "secret", fetch });

    const response = await handle(get("/cars/brands"), "/cars/brands?reference=338&x=1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ code: "21", name: "Fiat" }]);
    expect(fetch).toHaveBeenCalledWith(
      "https://fipe.parallelum.com.br/api/v2/cars/brands?reference=338",
      expect.objectContaining({ headers: { "X-Subscription-Token": "secret" } }),
    );
    // The token never reaches the browser.
    expect([...response.headers].flat().join(" ")).not.toContain("secret");
  });

  it.each([
    "/references",
    "/cars/brands/21/models",
    "/cars/brands/21/models/10/years",
    "/cars/brands/21/models/10/years/32000-5",
    "/motorcycles/brands/21/years",
    "/trucks/brands/21/years/2024-3/models",
    "/cars/001580-1/years/2024-5/history",
    "/cars/001580-1/years",
    "/trucks/509003-4/years/32000-3",
  ])("allows %s", async (path) => {
    const response = await createFipeProxy({ fetch: upstream() })(get(path), path);
    expect(response.status).toBe(200);
  });

  it.each([
    "/",
    "/boats/brands",
    "/cars/brands/21/../../admin",
    "/cars/brands/abc/models",
    "/https://evil.example",
  ])("refuses %s", async (path) => {
    const fetch = upstream();
    const response = await createFipeProxy({ fetch })(get(path), path);
    expect(response.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects bad references and non-GET methods", async () => {
    const handle = createFipeProxy({ fetch: upstream() });
    expect((await handle(get("/cars/brands"), "/cars/brands?reference=1;drop")).status).toBe(400);
    expect((await handle(get("/references", {}, "POST"), "/references")).status).toBe(405);
  });

  it("caches successful answers and serves them without calling FIPE", async () => {
    const fetch = upstream();
    const handle = createFipeProxy({ fetch, cache: createMemoryCache() });

    const miss = await handle(get("/cars/brands"), "/cars/brands?reference=338");
    const hit = await handle(get("/cars/brands"), "/cars/brands?reference=338");

    expect(miss.headers.get("X-Proxy-Cache")).toBe("MISS");
    expect(hit.headers.get("X-Proxy-Cache")).toBe("HIT");
    expect(await hit.json()).toEqual([{ code: "21", name: "Fiat" }]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("passes errors through without caching them", async () => {
    const fetch = upstream(429, { message: "limit" }, { "Retry-After": "3600" });
    const handle = createFipeProxy({ fetch, cache: createMemoryCache() });

    const first = await handle(get("/references"), "/references");
    await handle(get("/references"), "/references");

    expect(first.status).toBe(429);
    expect(first.headers.get("Retry-After")).toBe("3600");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("answers 504 on timeout and 502 when FIPE is unreachable", async () => {
    const timeout = vi.fn(async () => {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    }) as unknown as typeof fetch;
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    expect((await createFipeProxy({ fetch: timeout })(get("/references"), "/references")).status).toBe(504);
    expect((await createFipeProxy({ fetch: offline })(get("/references"), "/references")).status).toBe(502);
  });

  it("adds CORS headers only for allowed origins", async () => {
    const handle = createFipeProxy({
      fetch: upstream(),
      allowedOrigins: ["https://carronatela.example"],
    });

    const allowed = await handle(get("/references", { Origin: "https://carronatela.example" }), "/references");
    const other = await handle(get("/references", { Origin: "https://evil.example" }), "/references");
    const preflight = await handle(
      get("/references", { Origin: "https://carronatela.example" }, "OPTIONS"),
      "/references",
    );

    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://carronatela.example");
    expect(other.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(preflight.status).toBe(204);
  });
});

describe("cacheSeconds", () => {
  it("keeps month-bound answers for a month and the rest briefly", () => {
    expect(cacheSeconds("/cars/brands", "338")).toBe(30 * 24 * 60 * 60);
    expect(cacheSeconds("/references", null)).toBe(6 * 60 * 60);
    expect(cacheSeconds("/cars/brands", null)).toBe(60 * 60);
  });
});

describe("createMemoryCache", () => {
  it("expires entries", async () => {
    let now = 0;
    const cache = createMemoryCache(() => now);
    const key = new Request("https://x/a");
    await cache.put(key, new Response("1", { headers: { "Cache-Control": "public, max-age=10" } }));

    expect(await (await cache.match(key))?.text()).toBe("1");
    now = 10_000;
    expect(await cache.match(key)).toBeUndefined();
  });
});

describe("proxy keys", () => {
  it("orders the proxy key, the main key, then numbered keys from the highest", () => {
    expect(
      proxyTokensFromEnv({
        FIPE_TOKEN1: "one",
        FIPE_TOKEN10: "ten",
        FIPE_TOKEN2: " two ",
        FIPE_TOKEN: "main",
        FIPE_PROXY_TOKEN: "proxy",
        FIPE_TOKEN3: "",
        FIPE_TOKEN4: "ten",
        OTHER: "x",
      }),
    ).toEqual(["proxy", "main", "ten", "two", "one"]);
  });

  it("moves to the next key on 429 or rejection, ends anonymous, and remembers it", async () => {
    const sent: (string | null)[] = [];
    const statuses = [429, 403, 200, 200];
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get("X-Subscription-Token"));
      const status = statuses.shift() ?? 200;
      return new Response(status === 200 ? "[]" : "{}", { status });
    });
    const handle = createFipeProxy({ tokens: ["a", "b"], fetch: fetch as typeof globalThis.fetch });

    expect((await handle(new Request("http://x/"), "/references")).status).toBe(200);
    expect(sent).toEqual(["a", "b", null]);
    // The used-up keys stay skipped.
    await handle(new Request("http://x/"), "/cars/brands");
    expect(sent).toEqual(["a", "b", null, null]);
  });

  it("passes the anonymous 429 through when every key is used up", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 429, headers: { "Retry-After": "60" } }));
    const handle = createFipeProxy({ tokens: ["a"], fetch: fetch as typeof globalThis.fetch });
    const response = await handle(new Request("http://x/"), "/references");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
