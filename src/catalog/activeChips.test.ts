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

  it("drops a line's sub-lines with it", () => {
    const filters = { ...emptyCatalogFilters, families: ["Uno", "Gol"], sublines: ["Uno Way", "Gol G5"] };
    const uno = activeChips(filters).find((chip) => chip.key === "families:Uno");
    expect(uno?.remove).toEqual({ families: ["Gol"], sublines: ["Gol G5"] });
  });

  it("writes motorcycle engines in cc and car engines in liters", () => {
    const label = (category: "cars" | "motorcycles", engineMin: number, engineMax: number) =>
      activeChips({ ...emptyCatalogFilters, category, engineMin, engineMax })[0]?.label;
    expect(label("motorcycles", 150, 300)).toBe("Motor 150 cc a 300 cc");
    expect(label("cars", 1, 2)).toBe("Motor 1.0 a 2.0");
  });

  it("is empty without filters", () => {
    expect(activeChips(emptyCatalogFilters)).toEqual([]);
  });
});
