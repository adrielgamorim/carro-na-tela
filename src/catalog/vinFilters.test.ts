import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "./types";
import { vinCatalogFilters } from "./vinFilters";

const entry = (id: string, brand: string, model: string, modelYear: number) =>
  ({ id, category: "cars", brand, model, modelYear, codeFipe: "", fuel: "Flex", attributes: {} }) as unknown as CatalogEntry;

const entries = [
  entry("onix", "GM - Chevrolet", "ONIX LT 1.0", 2020),
  entry("accord", "Honda", "Accord EX 3.0 V6", 2003),
  entry("civic", "Honda", "Civic LXS 1.8", 2010),
];

describe("vinCatalogFilters", () => {
  it("filters by brand and year, and by the vPIC model when it matches", () => {
    const result = vinCatalogFilters(
      entries,
      { brands: ["Honda"], modelYear: 2003, model: "Accord" },
      "name",
    );
    expect(result).toMatchObject({ brands: ["Honda"], year: 2003, model: "Accord" });
    expect(result.filters).toMatchObject({
      brands: ["Honda"],
      yearMin: 2003,
      yearMax: 2003,
      query: "Accord",
      sort: "name",
    });
  });

  it("drops a year or model the catalog does not have", () => {
    const result = vinCatalogFilters(
      entries,
      { brands: ["GM - Chevrolet"], modelYear: 1997, model: "Cruze" },
      "price-asc",
    );
    expect(result).toMatchObject({ year: null, model: null });
    expect(result.filters).toMatchObject({ brands: ["GM - Chevrolet"], yearMin: null, query: "" });
  });

  it("applies nothing when the maker has no brand in the catalog", () => {
    expect(vinCatalogFilters(entries, { brands: ["Scania"], modelYear: 2020 }, "name")).toEqual({
      filters: null,
      brands: [],
      year: null,
      model: null,
    });
  });
});

describe("vinCatalogFilters across categories", () => {
  const all = [
    ...entries,
    { ...entries[1]!, id: "cg", category: "motorcycles", model: "CG 160 Titan" } as CatalogEntry,
    { ...entries[0]!, id: "fh", category: "trucks", brand: "Volvo", model: "FH 540" } as CatalogEntry,
  ];

  it("opens the category the manufacturer names, else the one shown, else the first with the brand", () => {
    const honda = (categories: ("cars" | "motorcycles" | "trucks")[], shown?: "cars" | "motorcycles") =>
      vinCatalogFilters(all, { brands: ["Honda"], modelYear: null, categories }, "name", shown).filters?.category;
    expect(honda(["motorcycles"])).toBe("motorcycles");
    expect(honda([])).toBe("cars");
    expect(honda([], "motorcycles")).toBe("motorcycles");
    expect(vinCatalogFilters(all, { brands: ["Volvo"], modelYear: null }, "name").filters?.category).toBe("trucks");
  });
});
