import { describe, expect, it } from "vitest";
import { fipeTrend } from "./fipeTrend";

const month = (reference: number, value: number) => ({
  reference: String(reference),
  month: `mês ${reference}`,
  price: `R$ ${value.toLocaleString("pt-BR")},00`,
});

describe("fipeTrend", () => {
  it("measures the last month and the whole history, in any order", () => {
    const trend = fipeTrend([month(338, 98_000), month(339, 95_000), month(337, 100_000)])!;
    expect(trend.month).toBeCloseTo(-3.06, 2);
    expect(trend.total).toBeCloseTo(-5, 5);
    expect(trend.months).toBe(2);
    expect(trend.since).toBe("mês 337");
    // -2.5% a month: past normal depreciation.
    expect(trend.signal).toBe("queda");
  });

  it("flags a rise, and nothing for normal depreciation", () => {
    expect(fipeTrend([month(339, 101_600), month(337, 100_000)])!.signal).toBe("alta");
    expect(fipeTrend([month(339, 98_500), month(337, 100_000)])!.signal).toBeNull();
  });

  it("needs two months, and leaves out the month change across a gap", () => {
    expect(fipeTrend([month(339, 100_000)])).toBeNull();
    expect(fipeTrend([])).toBeNull();
    expect(fipeTrend([month(339, 100_000), month(337, 101_000)])!.month).toBeNull();
  });
});
