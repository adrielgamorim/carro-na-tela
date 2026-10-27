// Single HTTP layer for the app: JSON requests with a timeout, cancellation
// through AbortSignal, and typed errors instead of message parsing.

export type HttpErrorKind =
  | "http" // non-2xx answer other than 429
  | "rate-limit" // 429
  | "timeout"
  | "network" // no answer (offline, DNS, CORS)
  | "aborted" // the caller gave up
  | "parse"; // answer was not valid JSON

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  readonly status: number | null;
  /** Who answered (or failed to), e.g. "FIPE". */
  readonly provider: string;
  readonly url: string;

  constructor(
    kind: HttpErrorKind,
    provider: string,
    url: string,
    status: number | null = null,
  ) {
    super(`${provider} request ${kind}${status ? ` (${status})` : ""}: ${url}`);
    this.name = "HttpError";
    this.kind = kind;
    this.provider = provider;
    this.url = url;
    this.status = status;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof HttpError && error.kind === "aborted";
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

const defaultTimeoutMs = 15_000;

export async function requestJson<T>(
  provider: string,
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { signal, timeoutMs = defaultTimeoutMs, headers } = options;
  const fetchImpl = options.fetch ?? fetch;
  if (signal?.aborted) throw new HttpError("aborted", provider, url);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetchImpl(url, { headers, signal: controller.signal });
    } catch {
      if (timedOut) throw new HttpError("timeout", provider, url);
      if (signal?.aborted) throw new HttpError("aborted", provider, url);
      throw new HttpError("network", provider, url);
    }

    if (response.status === 429) {
      throw new HttpError("rate-limit", provider, url, 429);
    }
    if (!response.ok) {
      throw new HttpError("http", provider, url, response.status);
    }
    try {
      return (await response.json()) as T;
    } catch {
      if (timedOut) throw new HttpError("timeout", provider, url);
      if (signal?.aborted) throw new HttpError("aborted", provider, url);
      throw new HttpError("parse", provider, url, response.status);
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

interface CacheEntry {
  promise: Promise<unknown>;
  controller: AbortController;
  consumers: number;
  settled: boolean;
}

/**
 * Deduplicates requests by key and keeps successful results. Callers pass
 * their own signal: when every caller waiting on an unfinished request has
 * aborted, the request itself is aborted and dropped from the cache. Failed
 * requests are dropped too, so the next call retries.
 */
export function createRequestCache() {
  const entries = new Map<string, CacheEntry>();

  function drop(key: string, entry: CacheEntry) {
    if (entries.get(key) === entry) entries.delete(key);
  }

  function get<T>(
    key: string,
    load: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    let entry = entries.get(key);
    if (!entry) {
      const controller = new AbortController();
      const created: CacheEntry = {
        controller,
        consumers: 0,
        settled: false,
        promise: Promise.resolve(),
      };
      created.promise = load(controller.signal).then(
        (value) => {
          created.settled = true;
          return value;
        },
        (error: unknown) => {
          drop(key, created);
          throw error;
        },
      );
      // Avoid unhandled rejections when every consumer already left.
      created.promise.catch(() => {});
      entries.set(key, created);
      entry = created;
    }

    const current = entry;
    if (current.settled || !signal) return current.promise as Promise<T>;

    return new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        reject(new HttpError("aborted", "cache", key));
        return;
      }
      current.consumers += 1;
      let done = false;
      const leave = () => {
        done = true;
        current.consumers -= 1;
        signal.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        if (done) return;
        leave();
        if (current.consumers === 0 && !current.settled) {
          drop(key, current);
          current.controller.abort();
        }
        reject(new HttpError("aborted", "cache", key));
      };
      signal.addEventListener("abort", onAbort);
      current.promise.then(
        (value) => {
          if (done) return;
          leave();
          resolve(value as T);
        },
        (error: unknown) => {
          if (done) return;
          leave();
          reject(error);
        },
      );
    });
  }

  return { get, clear: () => entries.clear(), size: () => entries.size };
}
