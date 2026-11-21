import { describe, expect, it } from "vitest";
import type { CrawlSnapshot } from "./catalog-index.ts";
import { emptyPriceHistory, mergeSnapshots, sliceByBrand } from "./price-history.ts";

const snapshot = (reference: number, prices: Record<string, number | null>): CrawlSnapshot =>
  ({
    reference: String(reference),
    referenceMonth: `mês ${reference}`,
    category: "cars",
    listingComplete: true,
    vehicles: Object.entries(prices).map(([id, priceValue]) => ({
      id,
      ...(priceValue && { detail: { priceValue } }),
    })),
  }) as unknown as CrawlSnapshot;

describe("mergeSnapshots", () => {
  it("adds each month's prices and keeps the last 13 months", () => {
    let history = emptyPriceHistory();
    for (let reference = 320; reference <= 339; reference++) {
      history = mergeSnapshots(history, [snapshot(reference, { "1-1:2020-1": reference * 100, "2-5:2021-1": null })]);
    }
    expect(Object.keys(history.months)).toHaveLength(13);
    expect(Object.keys(history.months)[0]).toBe("327");
    expect(history.prices["1-1:2020-1"]!["339"]).toBe(33_900);
    expect(history.prices["1-1:2020-1"]!["326"]).toBeUndefined();
    // Never priced: not kept.
    expect(history.prices["2-5:2021-1"]).toBeUndefined();
  });

  it("does not count a month with no prices yet", () => {
    const history = mergeSnapshots(emptyPriceHistory(), [snapshot(340, { "1-1:2020-1": null })]);
    expect(history.months).toEqual({});
  });

  it("slices per brand", () => {
    const history = mergeSnapshots(emptyPriceHistory(), [snapshot(339, { "1-1:2020-1": 10, "21-9:2020-1": 20 })]);
    expect([...sliceByBrand("cars", history).keys()]).toEqual(["historico/cars-1.json", "historico/cars-21.json"]);
  });
});
