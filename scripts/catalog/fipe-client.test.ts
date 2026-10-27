import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFipeClient, fipeKeysFromEnv, FipeRequestError, FipeStopError } from "./fipe-client.ts";

type Reply = { status: number; body?: unknown; remaining?: number } | Error;

function fakeFetch(replies: Reply[]) {
  const calls: string[] = [];
  const fetch = (async (input: string | URL | Request) => {
    calls.push(String(input));
    const reply = replies.shift();
    if (!reply) throw new Error("unexpected request");
    if (reply instanceof Error) throw reply;
    const headers = new Headers();
    if (reply.remaining !== undefined) {
      headers.set("x-ratelimit-remaining", String(reply.remaining));
    }
    return new Response(
      reply.body === undefined ? null : JSON.stringify(reply.body),
      { status: reply.status, headers },
    );
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("createFipeClient", () => {
  let cacheDir: string;
  const noSleep = async () => {};

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "fipe-cache-"));
  });

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("caches responses per reference and serves them without requests", async () => {
    const { fetch, calls } = fakeFetch([
      { status: 200, body: [{ code: "21", name: "Fiat" }] },
      { status: 200, body: [{ code: "21", name: "Fiat (antiga)" }] },
    ]);
    const client = createFipeClient({ cacheDir, fetch, sleep: noSleep });

    const first = await client.get("/cars/brands", { reference: "338" });
    const second = await client.get("/cars/brands", { reference: "338" });
    const otherMonth = await client.get("/cars/brands", { reference: "337" });

    expect(first).toEqual([{ code: "21", name: "Fiat" }]);
    expect(second).toEqual(first);
    expect(otherMonth).toEqual([{ code: "21", name: "Fiat (antiga)" }]);
    expect(calls).toEqual([
      "https://fipe.parallelum.com.br/api/v2/cars/brands?reference=338",
      "https://fipe.parallelum.com.br/api/v2/cars/brands?reference=337",
    ]);

    const reopened = createFipeClient({ cacheDir, fetch, sleep: noSleep });
    expect(await reopened.get("/cars/brands", { reference: "338" })).toEqual(
      first,
    );
    expect(reopened.stats()).toMatchObject({ requests: 0, cacheHits: 1 });
  });

  it("caches 404 as null", async () => {
    const { fetch, calls } = fakeFetch([{ status: 404 }]);
    const client = createFipeClient({ cacheDir, fetch, sleep: noSleep });

    expect(await client.get("/cars/brands/1/years", { reference: "1" })).toBeNull();
    expect(await client.get("/cars/brands/1/years", { reference: "1" })).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("serves only cached responses when offline", async () => {
    const online = createFipeClient({
      cacheDir,
      sleep: noSleep,
      fetch: fakeFetch([{ status: 200, body: ["cached"] }]).fetch,
    });
    await online.get("/a", { reference: "338" });

    const { fetch, calls } = fakeFetch([]);
    const offline = createFipeClient({ cacheDir, fetch, offline: true });
    expect(await offline.get("/a", { reference: "338" })).toEqual(["cached"]);
    expect(await offline.get("/b", { reference: "338" })).toBeNull();
    expect(calls).toHaveLength(0);
    expect(offline.stats()).toMatchObject({ requests: 0, cacheHits: 1, cacheMisses: 1 });
  });

  it("skips the cache when asked", async () => {
    const { fetch, calls } = fakeFetch([
      { status: 200, body: [1] },
      { status: 200, body: [2] },
    ]);
    const client = createFipeClient({ cacheDir, fetch, sleep: noSleep });

    await client.get("/references", { cache: false });
    expect(await client.get("/references", { cache: false })).toEqual([2]);
    expect(calls).toHaveLength(2);
  });

  it("stops at the request budget", async () => {
    const { fetch } = fakeFetch([{ status: 200, body: [] }]);
    const client = createFipeClient({
      cacheDir,
      fetch,
      sleep: noSleep,
      maxRequests: 1,
    });

    await client.get("/a");
    await expect(client.get("/b")).rejects.toMatchObject({
      name: "FipeStopError",
      reason: "budget",
    });
  });

  it("stops on 429 and when the daily reserve is reached", async () => {
    const limited = createFipeClient({
      cacheDir,
      sleep: noSleep,
      fetch: fakeFetch([{ status: 429 }]).fetch,
    });
    await expect(limited.get("/a")).rejects.toBeInstanceOf(FipeStopError);

    const { fetch, calls } = fakeFetch([{ status: 200, body: [], remaining: 5 }]);
    const reserved = createFipeClient({ cacheDir, fetch, sleep: noSleep, reserve: 5 });
    await reserved.get("/b");
    await expect(reserved.get("/c")).rejects.toMatchObject({ reason: "rate-limit" });
    expect(calls).toHaveLength(1);
  });

  it("retries server and network errors, then gives up", async () => {
    const { fetch } = fakeFetch([
      { status: 503 },
      new TypeError("fetch failed"),
      { status: 200, body: ["ok"] },
    ]);
    const client = createFipeClient({ cacheDir, fetch, sleep: noSleep });
    expect(await client.get("/a")).toEqual(["ok"]);

    const failing = createFipeClient({
      cacheDir,
      sleep: noSleep,
      retries: 1,
      fetch: fakeFetch([new TypeError("down"), new TypeError("down")]).fetch,
    });
    await expect(failing.get("/b")).rejects.toMatchObject({ reason: "network" });
  });

  it("raises a request error for other client errors", async () => {
    const client = createFipeClient({
      cacheDir,
      sleep: noSleep,
      fetch: fakeFetch([{ status: 400 }]).fetch,
    });
    await expect(client.get("/a")).rejects.toBeInstanceOf(FipeRequestError);
  });

  it("sends the subscription token", async () => {
    let sentHeaders: RequestInit["headers"];
    const fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      sentHeaders = init?.headers;
      return new Response("[]", { status: 200 });
    }) as typeof globalThis.fetch;
    const client = createFipeClient({ cacheDir, fetch, token: "abc" });

    await client.get("/a");
    expect(sentHeaders).toEqual({ "X-Subscription-Token": "abc" });
  });

  it("moves to the next key on 429, rejection or the reserve", async () => {
    const sent: (string | undefined)[] = [];
    const replies: Reply[] = [
      { status: 429 },
      { status: 401 },
      // The reserve does not hold K3 back: it moves on only when used up.
      { status: 200, body: ["c"], remaining: 3 },
      { status: 200, body: ["d"], remaining: 0 },
      { status: 200, body: ["e"], remaining: 3 },
    ];
    const fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      sent.push((init?.headers as Record<string, string>)["X-Subscription-Token"]);
      const reply = replies.shift() as { status: number; body?: unknown; remaining?: number };
      const headers = new Headers();
      if (reply.remaining !== undefined) headers.set("x-ratelimit-remaining", String(reply.remaining));
      return new Response(reply.body ? JSON.stringify(reply.body) : null, { status: reply.status, headers });
    }) as typeof globalThis.fetch;
    const changes: string[] = [];
    const client = createFipeClient({
      cacheDir,
      fetch,
      sleep: noSleep,
      reserve: 3,
      keys: [
        { label: "K1", token: "1" },
        { label: "K2", token: "2" },
        { label: "K3", token: "3" },
        { label: "sem chave" },
      ],
      onKeyChange: (key) => changes.push(key.label),
    });

    expect(await client.get("/a")).toEqual(["c"]);
    expect(await client.get("/b")).toEqual(["d"]);
    expect(await client.get("/c")).toEqual(["e"]);
    expect(sent).toEqual(["1", "2", "3", "3", undefined]);
    expect(changes).toEqual(["K2", "K3", "sem chave"]);
    expect(client.stats()).toMatchObject({ requests: 5, key: "sem chave", keysUsed: 4 });

    // The last key keeps its reserve of 3.
    await expect(client.get("/d")).rejects.toMatchObject({
      reason: "rate-limit",
      message: expect.stringMatching(/^sem chave: daily limit nearly reached \(3 left, reserve 3\)/),
    });
  });
});

describe("fipeKeysFromEnv", () => {
  it("orders FIPE_TOKEN, then numbered keys, skipping empty and repeated ones", () => {
    expect(
      fipeKeysFromEnv({
        FIPE_TOKEN10: "j",
        FIPE_TOKEN2: "b",
        FIPE_TOKEN1: " a ",
        FIPE_TOKEN3: "",
        FIPE_TOKEN4: "b",
        FIPE_TOKEN: "main",
        FIPE_PROXY_TOKEN: "proxy",
        VITE_FIPE_TOKEN: "x",
      }),
    ).toEqual([
      { label: "FIPE_TOKEN", token: "main" },
      { label: "FIPE_TOKEN1", token: "a" },
      { label: "FIPE_TOKEN2", token: "b" },
      { label: "FIPE_TOKEN10", token: "j" },
      { label: "sem chave" },
    ]);
  });
});
