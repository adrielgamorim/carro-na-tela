import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// FIPE (Parallelum v2) client for offline scripts. Every response is cached on
// disk per reference month, so an interrupted crawl resumes without spending
// requests again. Responses for a reference never change, so the cache never
// expires; pass `cache: false` for lists that do (e.g. references).

export class FipeStopError extends Error {
  readonly reason: "budget" | "rate-limit" | "network";

  constructor(reason: FipeStopError["reason"], message: string) {
    super(message);
    this.name = "FipeStopError";
    this.reason = reason;
  }
}

export class FipeRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FipeRequestError";
    this.status = status;
  }
}

/** A subscription key; without `token` requests go anonymous (limit per IP). */
export interface FipeKey {
  label: string;
  token?: string;
}

export interface FipeClientOptions {
  cacheDir: string;
  baseUrl?: string;
  /** Shorthand for a single key. */
  token?: string;
  /**
   * Keys tried in order: when one reaches its daily limit (429 or the reserve)
   * or is rejected (401/403), the next one takes over.
   */
  keys?: FipeKey[];
  onKeyChange?: (key: FipeKey, reason: string) => void;
  /** Network requests allowed in this run (cache hits are free). */
  maxRequests?: number;
  /**
   * Stop when the API reports this many requests left for the day on the last
   * key; earlier keys are used up to zero before the next one takes over.
   */
  reserve?: number;
  minIntervalMs?: number;
  retries?: number;
  /** Serve only cached responses; a cache miss returns null without a request. */
  offline?: boolean;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface FipeGetOptions {
  reference?: string;
  cache?: boolean;
}

type CacheEntry<T> = { status: 200; body: T } | { status: 404 };

const defaultBaseUrl = "https://fipe.parallelum.com.br/api/v2";

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function readCache<T>(file: string): Promise<CacheEntry<T> | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as CacheEntry<T>;
  } catch {
    return undefined;
  }
}

async function writeCache<T>(file: string, entry: CacheEntry<T>) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(entry));
  await rename(temporary, file);
}

export function createFipeClient(options: FipeClientOptions) {
  const baseUrl = options.baseUrl ?? defaultBaseUrl;
  const maxRequests = options.maxRequests ?? Number.POSITIVE_INFINITY;
  const reserve = options.reserve ?? 0;
  const minIntervalMs = options.minIntervalMs ?? 0;
  const retries = options.retries ?? 2;
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? wait;
  const keys = options.keys?.length
    ? options.keys
    : [{ label: options.token ? "token" : "anonymous", token: options.token }];
  let keyIndex = 0;
  let requests = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  // Requests left today for the current key, as last reported by the API.
  let remaining: number | undefined;
  let lastRequestAt = 0;

  function switchKey(reason: string) {
    keyIndex += 1;
    remaining = undefined;
    if (keyIndex >= keys.length) {
      throw new FipeStopError(
        "rate-limit",
        keys.length > 1 ? `${reason}; no keys left` : reason,
      );
    }
    options.onKeyChange?.(keys[keyIndex], reason);
  }

  function cacheFile(path: string, reference: string | undefined) {
    return join(options.cacheDir, reference ?? "_global", `${path}.json`);
  }

  async function throttle() {
    const elapsed = Date.now() - lastRequestAt;
    if (lastRequestAt > 0 && elapsed < minIntervalMs) {
      await sleep(minIntervalMs - elapsed);
    }
    lastRequestAt = Date.now();
  }

  /** Returns the parsed body, or null when the API answers 404. */
  async function get<T>(path: string, getOptions: FipeGetOptions = {}) {
    const { reference, cache = true } = getOptions;
    const file = cacheFile(path, reference);

    if (cache) {
      const cached = await readCache<T>(file);
      if (cached) {
        cacheHits += 1;
        return cached.status === 404 ? null : cached.body;
      }
    }
    if (options.offline) {
      cacheMisses += 1;
      return null;
    }

    const url = new URL(`${baseUrl}${path}`);
    if (reference) url.searchParams.set("reference", reference);

    // Retries count server and network errors only; switching keys is free.
    for (let attempt = 0; ; ) {
      if (requests >= maxRequests) {
        throw new FipeStopError(
          "budget",
          `Request budget of ${maxRequests} reached`,
        );
      }
      // Only the last key keeps a reserve (usually the anonymous access, which
      // the site's proxy shares); the others are used up before moving on.
      const keep = () => (keyIndex === keys.length - 1 ? reserve : 0);
      while (remaining !== undefined && remaining <= keep()) {
        switchKey(
          `${keys[keyIndex].label}: daily limit ${remaining > 0 ? "nearly " : ""}reached (${remaining} left, reserve ${keep()})`,
        );
      }

      await throttle();
      requests += 1;

      const { token } = keys[keyIndex];
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: token ? { "X-Subscription-Token": token } : {},
        });
      } catch (error) {
        if (attempt < retries) {
          await sleep(1000 * 2 ** attempt);
          attempt += 1;
          continue;
        }
        throw new FipeStopError(
          "network",
          `Network error for ${path}: ${(error as Error).message}`,
        );
      }

      const remainingHeader = response.headers.get("x-ratelimit-remaining");
      if (remainingHeader !== null) remaining = Number(remainingHeader);

      if (response.status === 429) {
        switchKey(`${keys[keyIndex].label}: FIPE API answered 429`);
        continue;
      }
      if ((response.status === 401 || response.status === 403) && token) {
        switchKey(`${keys[keyIndex].label}: key rejected (${response.status})`);
        continue;
      }
      if (response.status === 404) {
        if (cache) await writeCache<T>(file, { status: 404 });
        return null;
      }
      if (response.status >= 500 && attempt < retries) {
        await sleep(1000 * 2 ** attempt);
        attempt += 1;
        continue;
      }
      if (!response.ok) {
        throw new FipeRequestError(
          response.status,
          `FIPE API request failed (${response.status}) for ${path}`,
        );
      }

      const body = (await response.json()) as T;
      if (cache) await writeCache(file, { status: 200, body });
      return body;
    }
  }

  return {
    get,
    stats: () => ({
      requests,
      cacheHits,
      cacheMisses,
      remaining,
      key: keys[Math.min(keyIndex, keys.length - 1)].label,
      keysUsed: Math.min(keyIndex + 1, keys.length),
    }),
  };
}

export type FipeClient = ReturnType<typeof createFipeClient>;

/**
 * Keys from the environment, in the order they are used: FIPE_TOKEN, then
 * FIPE_TOKEN1, FIPE_TOKEN2… (any number), skipping empty and repeated values.
 * Anonymous access (500 requests a day per IP) comes last.
 */
export function fipeKeysFromEnv(env: Record<string, string | undefined>): FipeKey[] {
  const names = Object.keys(env)
    .filter((name) => /^FIPE_TOKEN\d*$/.test(name))
    .sort((left, right) => Number(left.slice(10) || -1) - Number(right.slice(10) || -1));
  const keys: FipeKey[] = [];
  for (const name of names) {
    const token = env[name]?.trim();
    if (token && !keys.some((key) => key.token === token)) {
      keys.push({ label: name, token });
    }
  }
  return [...keys, { label: "sem chave" }];
}
