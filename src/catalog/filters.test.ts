import { describe, expect, it } from "vitest";
import {
  catalogBounds,
  computeFacets,
  countActiveFilters,
  emptyCatalogFilters,
  filterCatalog,
  groupCatalog,
  readCatalogParams,
  writeCatalogParams,
} from "./filters";
import type { CatalogFilters } from "./filters";
import type { CatalogEntry } from "./types";

function entry(overrides: Partial<CatalogEntry>): CatalogEntry {
  const attributes = overrides.attributes ?? {};
  return {
    // Merged fields default to what the FIPE name says, as without INMETRO data.
    transmission: attributes.transmission ?? null,
    gears: null,
    bodyType: attributes.bodyHint ?? null,
    size: null,
    steering: null,
    airConditioning: null,
    cityKmL: null,
    highwayKmL: null,
    inmetro: null,
    wikidata: null,
    fleet: null,
    press: null,
    origin: null,
    depreciation: null,
    id: "x",
    category: "cars",
    brand: "BYD",
    brandCode: "238",
    family: "Dolphin",
    model: "Dolphin Mini GL",
    modelCode: "1",
    codeFipe: "000-1",
    yearCode: "2025-4",
    modelYear: 2025,
    zeroKm: false,
    fuel: "Elétrico",
    propulsion: "eletrico",
    price: "",
    priceValue: 100000,
    referenceCode: "338",
    referenceMonth: "outubro de 2026",
    attributes: {},
    ...overrides,
    fipeBrand: overrides.fipeBrand ?? overrides.brand ?? "BYD",
  };
}

// Versions are grouped by brand + model code; reuse codeFipe as model code.
function version(overrides: Partial<CatalogEntry>): CatalogEntry {
  const built = entry(overrides);
  return { ...built, modelCode: built.codeFipe ?? built.modelCode };
}

const entries = [
  version({ id: "mini-0km", zeroKm: true, modelYear: null, yearCode: "32000-4", priceValue: 120000 }),
  version({ id: "mini-2025", priceValue: 110000 }),
  version({
    id: "song-2026",
    family: "Song",
    model: "Song Plus 1.5 16V Aut. (Hibrido)",
    codeFipe: "000-2",
    modelYear: 2026,
    fuel: "Híbrido",
    propulsion: "hibrido",
    priceValue: 230000,
    attributes: { transmission: "automatico", engineLiters: 1.5 },
  }),
  version({
    id: "pulse-2024",
    brand: "Fiat",
    family: "PULSE",
    model: "PULSE AUDACE 1.0 Turbo 200 Flex Aut.",
    codeFipe: "001-1",
    modelYear: 2024,
    fuel: "Flex",
    propulsion: "combustao",
    priceValue: 98000,
    attributes: { transmission: "automatico", aspiration: "turbo" },
  }),
];

const filters = (overrides: Partial<CatalogFilters>): CatalogFilters => ({
  ...emptyCatalogFilters,
  ...overrides,
});
const ids = (items: CatalogEntry[]) => items.map((item) => item.id);

describe("filterCatalog", () => {
  it("matches every query word, ignoring accents and case", () => {
    expect(ids(filterCatalog(entries, filters({ query: "song hibrido" })))).toEqual([
      "song-2026",
    ]);
    expect(ids(filterCatalog(entries, filters({ query: "001-1" })))).toEqual([
      "pulse-2024",
    ]);
  });

  it("combines list facets (OR within a facet, AND across facets)", () => {
    expect(
      ids(
        filterCatalog(
          entries,
          filters({ propulsions: ["eletrico", "combustao"], transmissions: ["automatico"] }),
        ),
      ),
    ).toEqual(["pulse-2024"]);
  });

  it("treats 0 km as newer than any year", () => {
    expect(ids(filterCatalog(entries, filters({ yearMin: 2026 })))).toEqual([
      "mini-0km",
      "song-2026",
    ]);
    expect(ids(filterCatalog(entries, filters({ yearMax: 2025 })))).toEqual([
      "mini-2025",
      "pulse-2024",
    ]);
    expect(ids(filterCatalog(entries, filters({ zeroKmOnly: true })))).toEqual([
      "mini-0km",
    ]);
  });

  it("filters by an inclusive price range and toggles", () => {
    expect(
      ids(filterCatalog(entries, filters({ priceMin: 100000, priceMax: 120000 }))),
    ).toEqual(["mini-0km", "mini-2025"]);
    expect(ids(filterCatalog(entries, filters({ turbo: true })))).toEqual([
      "pulse-2024",
    ]);
  });
});

describe("engine and doors filters", () => {
  const sized = [
    version({ id: "mobi", codeFipe: "m", attributes: { engineLiters: 1, doors: 5 } }),
    version({ id: "argo", codeFipe: "a", attributes: { engineLiters: 1.3, doors: 5 } }),
    version({ id: "toro", codeFipe: "t", attributes: { engineLiters: 2, doors: 4 } }),
    version({ id: "seal", codeFipe: "s", attributes: {} }),
  ];

  it("filters by an inclusive engine range, excluding unknown sizes", () => {
    expect(ids(filterCatalog(sized, filters({ engineMin: 1.3 })))).toEqual(["argo", "toro"]);
    expect(ids(filterCatalog(sized, filters({ engineMax: 1.3 })))).toEqual(["mobi", "argo"]);
    expect(catalogBounds(sized).engines).toEqual([1, 1.3, 2]);
  });

  it("filters and counts doors", () => {
    expect(ids(filterCatalog(sized, filters({ doors: ["4"] })))).toEqual(["toro"]);
    expect(computeFacets(sized, filters({})).lists.doors).toEqual([
      { value: "4", count: 1 },
      { value: "5", count: 2 },
    ]);
  });

  it("round-trips through the URL with decimal liters", () => {
    const selected = filters({ engineMin: 1.3, engineMax: 2, doors: ["4", "5"] });
    const params = new URLSearchParams();
    writeCatalogParams(selected, params);

    expect(params.toString()).toBe("portas=4&portas=5&motor=1.3-2");
    expect(readCatalogParams(params)).toEqual(selected);
    expect(countActiveFilters(selected)).toBe(3);
  });
});

describe("INMETRO filters", () => {
  const specs = [
    version({ id: "argo", codeFipe: "a", size: "compacto", bodyType: null, transmission: "cvt", gears: 7, cityKmL: 12.8, airConditioning: true, steering: "eletrica" }),
    version({ id: "tcross", codeFipe: "t", size: "compacto", bodyType: "suv", transmission: "automatico", gears: 6, cityKmL: 11.2, airConditioning: true }),
    version({ id: "dolphin", codeFipe: "d", size: "subcompacto", cityKmL: 58.6 }),
    version({ id: "old", codeFipe: "o" }),
  ];

  it("filters by size, body, gears, steering and air conditioning", () => {
    expect(ids(filterCatalog(specs, filters({ sizes: ["compacto"] })))).toEqual(["argo", "tcross"]);
    expect(ids(filterCatalog(specs, filters({ bodies: ["suv"] })))).toEqual(["tcross"]);
    expect(ids(filterCatalog(specs, filters({ gears: ["7"] })))).toEqual(["argo"]);
    expect(ids(filterCatalog(specs, filters({ steerings: ["eletrica"] })))).toEqual(["argo"]);
    expect(ids(filterCatalog(specs, filters({ airConditioning: true })))).toEqual(["argo", "tcross"]);
  });

  it("filters by minimum city consumption and sorts the most economical first", () => {
    expect(ids(filterCatalog(specs, filters({ consumptionMin: 12 })))).toEqual(["argo", "dolphin"]);
    expect(groupCatalog(specs, "consumption").map((group) => group.entries[0].id)).toEqual([
      "dolphin",
      "argo",
      "tcross",
      "old",
    ]);
  });

  it("round-trips the new filters through the URL", () => {
    const selected = filters({
      sizes: ["compacto"],
      gears: ["6"],
      steerings: ["eletrica"],
      airConditioning: true,
      consumptionMin: 12,
      sort: "consumption",
    });
    const params = new URLSearchParams();
    writeCatalogParams(selected, params);

    expect(params.toString()).toBe(
      "porte=compacto&marchas=6&direcao=eletrica&ar=1&consumo=12&ordem=consumption",
    );
    expect(readCatalogParams(params)).toEqual(selected);
  });
});

describe("entries without a crawled price", () => {
  const unpriced = version({
    id: "dolphin-2027",
    codeFipe: null,
    modelCode: "999",
    priceValue: null,
    price: null,
  });
  const withUnpriced = [...entries, unpriced];

  it("are excluded only when a price range is set", () => {
    expect(ids(filterCatalog(withUnpriced, filters({})))).toContain("dolphin-2027");
    expect(ids(filterCatalog(withUnpriced, filters({ priceMax: 1e9 })))).not.toContain(
      "dolphin-2027",
    );
  });

  it("sort last by price in both directions and are ignored by bounds", () => {
    const last = (sort: "price-asc" | "price-desc") =>
      groupCatalog(withUnpriced, sort).at(-1)?.entries[0].id;
    expect(last("price-asc")).toBe("dolphin-2027");
    expect(last("price-desc")).toBe("dolphin-2027");
    expect(catalogBounds(withUnpriced).priceMin).toBe(98000);
  });
});

describe("computeFacets", () => {
  it("counts each facet ignoring its own selection", () => {
    const facets = computeFacets(entries, filters({ brands: ["BYD"], propulsions: ["eletrico"] }));

    expect(facets.lists.brands).toEqual([
      { value: "BYD", count: 2 },
      { value: "Fiat", count: 0 },
    ]);
    expect(facets.lists.propulsions).toEqual([
      { value: "combustao", count: 0 },
      { value: "eletrico", count: 2 },
      { value: "hibrido", count: 1 },
    ]);
    expect(facets.lists.transmissions).toEqual([{ value: "automatico", count: 0 }]);
    expect(facets.toggles).toEqual({
      zeroKmOnly: 1,
      turbo: 0,
      fourWheelDrive: 0,
      airConditioning: 0,
    });
  });
});

describe("groupCatalog", () => {
  it("groups years of the same FIPE version and sorts groups", () => {
    const byPrice = groupCatalog(entries, "price-asc");
    expect(byPrice.map((group) => ids(group.entries))).toEqual([
      ["pulse-2024"],
      ["mini-0km", "mini-2025"],
      ["song-2026"],
    ]);
    expect(groupCatalog(entries, "price-desc")[0]?.key).toBe("cars:238:000-2");
    // Groups sort by their newest entry's price, the one the card shows.
    const cheaperOldYear = [
      version({ id: "a-0km", codeFipe: "a", zeroKm: true, modelYear: null, priceValue: 110 }),
      version({ id: "a-2020", codeFipe: "a", modelYear: 2020, priceValue: 50 }),
      version({ id: "b-0km", codeFipe: "b", zeroKm: true, modelYear: null, priceValue: 100 }),
    ];
    expect(groupCatalog(cheaperOldYear, "price-asc").map((group) => group.key)).toEqual([
      "cars:238:b",
      "cars:238:a",
    ]);
    expect(groupCatalog(entries, "newest")[0]?.key).toBe("cars:238:000-1");
    expect(groupCatalog(entries, "name").map((group) => group.key)).toEqual([
      "cars:238:000-1",
      "cars:238:000-2",
      "cars:238:001-1",
    ]);
  });

  it("sorts by fleet size, lines without fleet data last", () => {
    const fleet = (total: number) => ({
      reference: "setembro de 2026",
      lineCount: 2,
      line: { family: "x", total, rank: 1, years: {} },
    });
    const popular = [
      version({ id: "rare", codeFipe: "rare", family: "Rare", fleet: fleet(10) }),
      version({ id: "none", codeFipe: "none", family: "None" }),
      version({ id: "common", codeFipe: "common", family: "Common", fleet: fleet(5000) }),
    ];
    expect(groupCatalog(popular, "popular").map((group) => group.entries[0].id)).toEqual([
      "common",
      "rare",
      "none",
    ]);
  });

  it("takes one version per line at a time when sorting by fleet", () => {
    const fleet = (total: number) => ({
      reference: "setembro de 2026",
      lineCount: 2,
      line: { family: "x", total, rank: 1, years: {} },
    });
    const gol = (id: string, modelYear: number) =>
      version({ id, codeFipe: id, family: "Gol", modelYear, fleet: fleet(5000) });
    const lines = [
      gol("gol-2010", 2010),
      gol("gol-2015", 2015),
      gol("gol-2020", 2020),
      version({ id: "uno", codeFipe: "uno", family: "Uno", modelYear: 2012, fleet: fleet(3000) }),
      version({ id: "ka", codeFipe: "ka", family: "Ka", modelYear: 2019, fleet: fleet(100) }),
    ];
    expect(groupCatalog(lines, "popular").map((group) => group.entries[0].id)).toEqual([
      "gol-2020",
      "uno",
      "ka",
      "gol-2015",
      "gol-2010",
    ]);
  });
});

describe("catalogBounds", () => {
  it("ignores 0 km when computing the year range", () => {
    expect(catalogBounds(entries)).toEqual({
      yearMin: 2024,
      yearMax: 2026,
      priceMin: 98000,
      priceMax: 230000,
      engines: [1.5],
    });
  });
});

describe("catalog URL params", () => {
  it("round-trips filters and drops defaults", () => {
    const selected = filters({
      query: "song",
      brands: ["BYD", "GM - Chevrolet"],
      propulsions: ["hibrido"],
      yearMin: 2020,
      priceMax: 200000,
      turbo: true,
      sort: "newest",
    });
    const params = new URLSearchParams("view=catalogo");
    writeCatalogParams(selected, params);

    expect(params.toString()).toBe(
      "view=catalogo&q=song&marca=BYD&marca=GM+-+Chevrolet&propulsao=hibrido" +
        "&turbo=1&ano=2020-&preco=-200000&ordem=newest",
    );
    expect(readCatalogParams(params)).toEqual(selected);

    writeCatalogParams(emptyCatalogFilters, params);
    expect(params.toString()).toBe("view=catalogo");
  });

  it("ignores malformed values", () => {
    expect(readCatalogParams(new URLSearchParams("ano=abc&ordem=xyz"))).toEqual(
      emptyCatalogFilters,
    );
  });
});

describe("countActiveFilters", () => {
  it("counts each selected option, toggle and range", () => {
    expect(countActiveFilters(emptyCatalogFilters)).toBe(0);
    expect(
      countActiveFilters(
        filters({ brands: ["BYD", "Fiat"], turbo: true, yearMin: 2020, yearMax: 2024 }),
      ),
    ).toBe(4);
  });
});
