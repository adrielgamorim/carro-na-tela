import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequestCache, HttpError, isAbortError, requestJson } from "./http";

function respond(status: number, body: unknown = {}) {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

/** A fetch that never answers until its signal aborts. */
function hanging() {
  return vi.fn(
    (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("requestJson", () => {
  it("returns parsed JSON and sends headers", async () => {
    const fetch = respond(200, [{ code: "1" }]);
    await expect(
      requestJson("FIPE", "https://x/a", { fetch, headers: { "X-Token": "t" } }),
    ).resolves.toEqual([{ code: "1" }]);
    expect(fetch).toHaveBeenCalledWith(
      "https://x/a",
      expect.objectContaining({ headers: { "X-Token": "t" } }),
    );
  });

  it.each([
    [429, "rate-limit"],
    [404, "http"],
    [503, "http"],
  ])("types a %s answer as %s", async (status, kind) => {
    const error = await requestJson("FIPE", "https://x/a", { fetch: respond(status) }).catch(
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ kind, status, provider: "FIPE", url: "https://x/a" });
  });

  it("types network failures and invalid JSON", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(requestJson("FIPE", "u", { fetch: offline })).rejects.toMatchObject({
      kind: "network",
    });
    await expect(requestJson("FIPE", "u", { fetch: respond(200, "<html>") })).rejects.toMatchObject({
      kind: "parse",
    });
  });

  it("times out and aborts the underlying fetch", async () => {
    vi.useFakeTimers();
    const fetch = hanging();
    const request = requestJson("FIPE", "u", { fetch, timeoutMs: 1000 });
    vi.advanceTimersByTime(1000);
    await expect(request).rejects.toMatchObject({ kind: "timeout" });
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.signal?.aborted).toBe(true);
  });

  it("aborts when the caller's signal aborts", async () => {
    const controller = new AbortController();
    const request = requestJson("FIPE", "u", { fetch: hanging(), signal: controller.signal });
    controller.abort();
    const error = await request.catch((cause: unknown) => cause);
    expect(isAbortError(error)).toBe(true);
    await expect(
      requestJson("FIPE", "u", { fetch: hanging(), signal: controller.signal }),
    ).rejects.toMatchObject({ kind: "aborted" });
  });
});

describe("createRequestCache", () => {
  it("shares one request between callers and caches the result", async () => {
    const cache = createRequestCache();
    const load = vi.fn(async () => "value");

    const [first, second] = await Promise.all([
      cache.get("k", load),
      cache.get("k", load, new AbortController().signal),
    ]);
    expect([first, second]).toEqual(["value", "value"]);
    expect(await cache.get("k", load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("drops failures so the next call retries", async () => {
    const cache = createRequestCache();
    const load = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");

    await expect(cache.get("k", load)).rejects.toThrow("boom");
    await expect(cache.get("k", load)).resolves.toBe("ok");
  });

  it("aborts the request only when every waiting caller aborted", async () => {
    const cache = createRequestCache();
    let requestSignal: AbortSignal | undefined;
    let finish: (value: string) => void = () => {};
    const load = (signal: AbortSignal) => {
      requestSignal = signal;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    };
    const a = new AbortController();
    const b = new AbortController();
    const first = cache.get("k", load, a.signal);
    const second = cache.get("k", load, b.signal);

    a.abort();
    await expect(first).rejects.toMatchObject({ kind: "aborted" });
    expect(requestSignal?.aborted).toBe(false);

    finish("value");
    await expect(second).resolves.toBe("value");
  });

  it("cancels an abandoned request and starts fresh next time", async () => {
    const cache = createRequestCache();
    const signals: AbortSignal[] = [];
    const load = vi.fn(
      (signal: AbortSignal) =>
        new Promise<string>((resolve) => {
          signals.push(signal);
          if (signals.length === 2) resolve("second");
        }),
    );
    const controller = new AbortController();
    const first = cache.get("k", load, controller.signal);
    controller.abort();

    await expect(first).rejects.toMatchObject({ kind: "aborted" });
    expect(signals[0]?.aborted).toBe(true);
    expect(cache.size()).toBe(0);
    await expect(cache.get("k", load)).resolves.toBe("second");
  });
});
