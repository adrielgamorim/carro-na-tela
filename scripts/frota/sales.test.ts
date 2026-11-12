import { describe, expect, it } from "vitest";
import type { CatalogFleetLine } from "../../src/catalog/fleet.ts";
import { addFleetSales } from "./sales.ts";

const line = (family: string, years: Record<string, number>): CatalogFleetLine => ({
  family,
  total: Object.values(years).reduce((a, b) => a + b, 0),
  rank: 0,
  years,
});

describe("addFleetSales", () => {
  it("counts the year's vehicles and the month's growth of the two recent years", () => {
    const lines = [
      line("ONIX", { "2025": 100_000, "2026": 80_000 }),
      line("HB20", { "2025": 90_000, "2026": 85_000 }),
      line("GOL", { "2010": 50_000 }),
      line("NOVO", { "2026": 300 }),
    ];
    addFleetSales(lines, [{ "2025": 99_900, "2026": 70_000 }, { "2025": 90_000, "2026": 80_000 }, {}, undefined], 2026);
    expect(lines.map((item) => item.sales)).toEqual([
      { year: 80_000, yearRank: 2, month: 10_100, monthRank: 1 },
      { year: 85_000, yearRank: 1, month: 5_000, monthRank: 2 },
      undefined,
      // Not in the month before: no difference to show.
      { year: 300, yearRank: 3 },
    ]);
  });

  it("leaves the month out without the month before, and never goes below zero", () => {
    const lines = [line("ONIX", { "2026": 10 })];
    addFleetSales(lines, null, 2026);
    expect(lines[0]!.sales).toEqual({ year: 10, yearRank: 1 });
    addFleetSales(lines, [{ "2026": 12 }], 2026);
    expect(lines[0]!.sales).toEqual({ year: 10, yearRank: 1, month: 0 });
  });
});
