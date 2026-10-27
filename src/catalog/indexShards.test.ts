import { afterEach, describe, expect, it, vi } from "vitest";
import { findCatalogEntry, loadCatalogIndex, loadCatalogIndexFor, resetCatalogIndex } from "../services/providers/catalog";
import { emptyCatalogFilters, writeCatalogParams } from "./filters";
import { catalogParamKeys, clearCatalogParams } from "./catalogParams";
import { expandCatalogIndex } from "./indexFormat";
import type { CatalogIndexFile } from "./indexFormat";
import { brandShardPath, brandSlug, splitCatalogIndex } from "./indexShards";

const line = (family: string, rank: number) => ({ family, total: 1000 - rank, rank, years: {} });

const file: CatalogIndexFile = {
  version: 2,
  generatedAt: "2026-10-26T12:00:00.000Z",
  snapshots: [
    {
      category: "cars",
      reference: "338",
      referenceMonth: "outubro de 2026",
      brands: ["Fiat", "VW - VolksWagen"],
      availableBrands: 2,
      listingComplete: true,
      listed: 3,
      priced: 1,
    },
  ],
  brands: [
    { code: "21", name: "Fiat" },
    { code: "59", name: "VW - VolksWagen" },
  ],
  fuels: { "1": "Gasolina", "5": "Flex" },
  versions: [
    { s: 0, b: 0, m: "1", n: "ARGO DRIVE 1.3", y: [["2026-5", 90000]], w: 1, p: 2 },
    { s: 0, b: 1, m: "2", n: "Gol 1.0", y: [["2015-5", null]], p: 0 },
    { s: 0, b: 0, m: "3", n: "MOBI LIKE 1.0", y: [["2024-5", null]], w: 0, p: 1 },
  ],
  models: [
    { id: "Q1", label: "Fiat Mobi" },
    { id: "Q2", label: "Fiat Argo" },
  ],
  fleet: {
    reference: "setembro de 2026",
    source: "https://example.org/frota.zip",
    lines: [line("Gol", 1), line("MOBI", 2), line("ARGO", 3)],
  },
};

describe("brand slices", () => {
  it("names slices by category and brand", () => {
    expect(brandSlug("VW - VolksWagen")).toBe("vw-volkswagen");
    expect(brandSlug("Citroën")).toBe("citroen");
    expect(brandShardPath("cars", "Caoa Chery/Chery")).toBe("marcas/cars-caoa-chery-chery.json");
  });

  it("keeps each brand's versions, models and fleet lines, and the total line count", () => {
    const shards = splitCatalogIndex(file);
    expect([...shards.keys()]).toEqual(["marcas/cars-fiat.json", "marcas/cars-vw-volkswagen.json"]);

    const fiat = shards.get("marcas/cars-fiat.json")!;
    expect(fiat.brands).toEqual([{ code: "21", name: "Fiat" }]);
    expect(fiat.models).toEqual([{ id: "Q2", label: "Fiat Argo" }, { id: "Q1", label: "Fiat Mobi" }]);
    expect(fiat.fleet).toMatchObject({ lineCount: 3, lines: [line("ARGO", 3), line("MOBI", 2)] });

    // A slice expands to the same entries as the whole index.
    const whole = expandCatalogIndex(file).entries.filter((entry) => entry.brand === "Fiat");
    expect(expandCatalogIndex(fiat).entries).toEqual(whole);
    expect(whole[0]?.fleet).toMatchObject({ lineCount: 3, line: { family: "ARGO", rank: 3 } });
  });

  it("refuses two brands that would share a file", () => {
    const clash = { ...file, brands: [file.brands[0]!, { code: "99", name: "FIAT" }] };
    expect(() => splitCatalogIndex(clash)).toThrow(/mesmo arquivo/);
  });
});

describe("loadCatalogIndexFor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetCatalogIndex();
  });

  it("loads only the brand's slice, once, and null for brands without one", async () => {
    const shards = splitCatalogIndex(file);
    const fetch = vi.fn(async (url: string) => {
      const shard = shards.get(url.replace(/^.*catalog\//, ""));
      return shard
        ? new Response(JSON.stringify(shard))
        : new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetch);

    const vehicle = { category: "cars", brand: "Fiat", model: "ARGO DRIVE 1.3", yearCode: "2026-5" } as const;
    const index = await loadCatalogIndexFor(vehicle);
    expect(findCatalogEntry(index!, vehicle as never)?.wikidata?.label).toBe("Fiat Argo");
    await loadCatalogIndexFor({ category: "cars", brand: "Fiat" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toMatch(/catalog\/marcas\/cars-fiat\.json$/);

    await expect(loadCatalogIndexFor({ category: "motorcycles", brand: "Honda" })).resolves.toBeNull();
  });

  it("uses the whole index when it is loaded already", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(file)));
    vi.stubGlobal("fetch", fetch);
    await loadCatalogIndex();
    const index = await loadCatalogIndexFor({ category: "cars", brand: "VW - VolksWagen" });
    expect(index?.entries).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("catalogParamKeys", () => {
  it("covers every key the catalog writes", () => {
    const params = new URLSearchParams("view=catalogo&marcaId=22");
    writeCatalogParams(
      {
        ...emptyCatalogFilters,
        query: "onix",
        brands: ["Fiat"],
        families: ["ARGO"],
        propulsions: ["eletrico"],
        fuels: ["Flex"],
        transmissions: ["automatico"],
        bodies: ["suv"],
        doors: ["4"],
        sizes: ["compacto"],
        gears: ["6"],
        steerings: ["eletrica"],
        yearMin: 2020,
        priceMax: 100000,
        engineMin: 1,
        consumptionMin: 12,
        zeroKmOnly: true,
        airConditioning: true,
        turbo: true,
        fourWheelDrive: true,
        sort: "popular",
      } as never,
      params,
    );
    expect([...params.keys()].filter((key) => !catalogParamKeys.includes(key))).toEqual(["view", "marcaId"]);
    clearCatalogParams(params);
    expect(params.toString()).toBe("view=catalogo&marcaId=22");
  });
});
