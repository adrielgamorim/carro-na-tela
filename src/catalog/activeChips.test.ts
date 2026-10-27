import { describe, expect, it } from "vitest";
import { activeChips } from "./activeChips";
import { emptyCatalogFilters } from "./filters";
import { formatPrice } from "./labels";

describe("activeChips", () => {
  it("lists one removable chip per active value, with readable labels", () => {
    const filters = {
      ...emptyCatalogFilters,
      query: " onix ",
      brands: ["Fiat", "Jeep"],
      origins: ["importado" as const],
      yearMin: 2020,
      yearMax: 2020,
      priceMax: 100000,
      turbo: true,
    };
    const chips = activeChips(filters);
    expect(chips.map((chip) => chip.label)).toEqual([
      "“onix”",
      "Fiat",
      "Jeep",
      "Importado",
      "Ano 2020",
      `até ${formatPrice(100000)}`,
      "Turbo",
    ]);
    expect(chips.find((chip) => chip.label === "Fiat")?.remove).toEqual({ brands: ["Jeep"] });
    expect(chips.find((chip) => chip.key === "year")?.remove).toEqual({ yearMin: null, yearMax: null });
  });

  it("is empty without filters", () => {
    expect(activeChips(emptyCatalogFilters)).toEqual([]);
  });
});
