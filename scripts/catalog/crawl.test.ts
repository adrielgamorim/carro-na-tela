import { describe, expect, it } from "vitest";
import {
  assembleSnapshot,
  crawlListing,
  crawlPrices,
  priceOrder,
} from "./crawl.ts";
import { FipeRequestError, FipeStopError } from "./fipe-client.ts";
import type { FipeClient } from "./fipe-client.ts";

const detail = (model: string, codeFipe: string, modelYear: number) => ({
  brand: "Fiat",
  model,
  codeFipe,
  fuel: "Flex",
  fuelAcronym: "F",
  modelYear,
  price: "R$ 98.990,00",
  referenceMonth: "outubro de 2026",
});

const listingResponses: Record<string, unknown> = {
  "/cars/brands": [
    { code: "21", name: "Fiat" },
    { code: "59", name: "VW - VolksWagen" },
  ],
  "/cars/brands/21/years": [
    { code: "2008-1", name: "2008 Gasolina" },
    { code: "2024-5", name: "2024 Flex" },
    { code: "32000-5", name: "32000 Flex" },
  ],
  "/cars/brands/21/years/32000-5/models": [{ code: "10", name: "PULSE" }],
  "/cars/brands/21/years/2024-5/models": [
    { code: "10", name: "PULSE  AUDACE 1.0 Turbo 200 Flex Aut." },
    { code: "11", name: "ARGO" },
  ],
  "/cars/brands/59/years": [{ code: "2025-5", name: "2025 Flex" }],
  "/cars/brands/59/years/2025-5/models": [
    { code: "20", name: "T-Cross 200 TSI 1.0 Flex 5p Aut." },
  ],
};

const detailResponses: Record<string, unknown> = {
  "/cars/brands/21/models/10/years/32000-5": detail("PULSE", "001580-1", 32000),
  "/cars/brands/21/models/10/years/2024-5": detail("PULSE", "001580-1", 2024),
  "/cars/brands/21/models/11/years/2024-5": "error-400",
  "/cars/brands/59/models/20/years/2025-5": detail("T-Cross", "005530-5", 2025),
};

/** Serves `available`; anything else is a cache miss (null). */
function fakeClient(
  available: Record<string, unknown>,
  stopAfter = Number.POSITIVE_INFINITY,
) {
  const paths: string[] = [];
  let misses = 0;
  const client = {
    async get<T>(path: string) {
      if (paths.length >= stopAfter) {
        throw new FipeStopError("budget", "budget reached");
      }
      paths.push(path);
      const response = available[path];
      if (response === "error-400") {
        throw new FipeRequestError(400, "bad request");
      }
      if (response === undefined) misses += 1;
      return (response ?? null) as T | null;
    },
    stats: () => ({
      requests: paths.length,
      cacheHits: 0,
      cacheMisses: misses,
      remaining: undefined,
      key: "anonymous",
      keysUsed: 1,
    }),
  } satisfies FipeClient;
  return { client, paths };
}

// What the disk cache holds after both phases: failed requests are never cached.
const all = Object.fromEntries(
  Object.entries({ ...listingResponses, ...detailResponses }).filter(
    ([, response]) => response !== "error-400",
  ),
);
const key = (vehicle: { brandCode: string; modelCode: string; yearCode: string }) =>
  `${vehicle.brandCode}-${vehicle.modelCode}:${vehicle.yearCode}`;

describe("crawlListing", () => {
  it("lists every brand-year, newest years first across brands", async () => {
    const { client, paths } = fakeClient(listingResponses);
    const result = await crawlListing(client, { reference: "338", minYear: 2009 });

    expect(result.complete).toBe(true);
    expect(result.availableBrands).toBe(2);
    expect(result.vehicles.map(key)).toEqual([
      "21-10:32000-5",
      "59-20:2025-5",
      "21-10:2024-5",
      "21-11:2024-5",
    ]);
    expect(result.vehicles[2]).toMatchObject({
      brand: "Fiat",
      model: "PULSE AUDACE 1.0 Turbo 200 Flex Aut.",
      modelYear: 2024,
      fuel: "Flex",
    });
    // Every year list first, then model lists; 2008 is below minYear.
    expect(paths.slice(0, 3)).toEqual([
      "/cars/brands",
      "/cars/brands/21/years",
      "/cars/brands/59/years",
    ]);
    expect(paths).not.toContain("/cars/brands/21/years/2008-1/models");
  });

  it("filters brands", async () => {
    const { client } = fakeClient(listingResponses);
    const { vehicles } = await crawlListing(client, {
      reference: "338",
      brandCodes: ["59"],
    });
    expect(vehicles.map(key)).toEqual(["59-20:2025-5"]);
  });

  it("returns a partial listing when the client stops", async () => {
    const { client } = fakeClient(listingResponses, 4);
    const result = await crawlListing(client, { reference: "338" });

    expect(result.complete).toBe(false);
    expect(result.stopReason).toBe("budget reached");
    expect(result.vehicles.map((vehicle) => vehicle.yearCode)).toEqual(["32000-5"]);
  });
});

describe("crawlPrices", () => {
  it("fetches details 0 km first, then newest years, skipping failures", async () => {
    const { client: listingClient } = fakeClient(listingResponses);
    const { vehicles } = await crawlListing(listingClient, { reference: "338" });

    const { client, paths } = fakeClient(detailResponses);
    const result = await crawlPrices(client, [...vehicles].reverse(), {
      reference: "338",
    });

    expect(result).toMatchObject({ complete: true, fetched: 4 });
    expect(result.failures).toEqual([
      { path: "/cars/brands/21/models/11/years/2024-5", status: 400 },
    ]);
    expect(paths[0]).toBe("/cars/brands/21/models/10/years/32000-5");
    expect(paths[1]).toBe("/cars/brands/59/models/20/years/2025-5");
  });

  it("stops with a reason when the budget ends", async () => {
    const { client: listingClient } = fakeClient(listingResponses);
    const { vehicles } = await crawlListing(listingClient, { reference: "338" });
    const { client } = fakeClient(detailResponses, 2);

    expect(await crawlPrices(client, vehicles, { reference: "338" })).toMatchObject({
      complete: false,
      fetched: 2,
      stopReason: "budget reached",
    });
  });

  it("orders 0 km before every model year", () => {
    const base = { brandCode: "1", brand: "", modelCode: "1", model: "", fuel: "" };
    const sorted = [
      { ...base, yearCode: "2020-1", modelYear: 2020 },
      { ...base, yearCode: "32000-1", modelYear: 32000 },
      { ...base, yearCode: "2026-1", modelYear: 2026 },
    ].sort(priceOrder);
    expect(sorted.map((vehicle) => vehicle.modelYear)).toEqual([32000, 2026, 2020]);
  });
});

describe("assembleSnapshot", () => {
  it("joins cached listing and details; unpriced versions keep detail null", async () => {
    const { client } = fakeClient(all);
    const snapshot = await assembleSnapshot(client, { reference: "338" });

    expect(snapshot.listingComplete).toBe(true);
    expect(snapshot.pricesComplete).toBe(false);
    expect(snapshot.stats).toEqual({
      availableBrands: 2,
      brands: 2,
      brandYears: 3,
      listed: 4,
      priced: 3,
    });
    expect(snapshot.vehicles[0]).toMatchObject({
      id: "21-10:32000-5",
      zeroKm: true,
      detail: { codeFipe: "001580-1", priceValue: 98990 },
    });
    expect(snapshot.vehicles.find((vehicle) => vehicle.modelCode === "11")).toMatchObject({
      id: "21-11:2024-5",
      detail: null,
    });
    expect(snapshot.vehicles[2]?.attributes).toMatchObject({
      aspiration: "turbo",
      transmission: "automatico",
    });
  });

  it("flags an incomplete listing when listing responses are missing", async () => {
    const partial = { ...all };
    delete partial["/cars/brands/59/years"];
    const { client } = fakeClient(partial);
    const snapshot = await assembleSnapshot(client, { reference: "338" });

    expect(snapshot.listingComplete).toBe(false);
    expect(snapshot.stats.brands).toBe(1);
  });
});
