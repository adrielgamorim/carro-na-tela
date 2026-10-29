import { describe, expect, it } from "vitest";
import { aggregateAutoseg, autosegRow } from "./autoseg.ts";
import { estimateInsurance, formatInsurance, formatTheft } from "../../src/catalog/safety.ts";

describe("AUTOSEG", () => {
  it("reads a row of cars, not of trucks or empty ones", () => {
    expect(autosegRow("1;11;025081-3;2006;F;5;10;500;0;0;10000;1;0;0;0;0;0;0;0;0;0;2021A")).toEqual({
      category: 1,
      region: "11",
      code: "025081-3",
      exposure: 10,
      premium: 500,
      insured: 10000,
      thefts: 1,
    });
    expect(autosegRow("4;11;025081-3;2006;F;5;10;500;0;0;10000;1;0;0;0;0;0;0;0;0;0;2021A")).toBeUndefined();
    expect(autosegRow("1;11;025081-3;2006;F;5;0;0;0;0;10000;0;0;0;0;0;0;0;0;0;0;2021A")).toBeUndefined();
  });

  it("sums a FIPE code's rate and thefts, and each state's premiums against the country's", async () => {
    const rows = [
      { category: 1, region: "11", code: "A", exposure: 20, premium: 1200, insured: 20000, thefts: 2 },
      { category: 1, region: "28", code: "A", exposure: 20, premium: 400, insured: 20000, thefts: 0 },
      { category: 1, region: "11", code: "B", exposure: 5, premium: 100, insured: 10000, thefts: 0 },
    ];
    const file = await aggregateAutoseg(rows, { period: "2021A", source: "x" });
    // A: 1.600 of premium over 40 vehicle-years of 20.000 = 0,2%; 2 thefts in 40 = 50 per thousand.
    expect(file.models).toEqual({ A: [40, 0.002, 50] });
    expect(file.nationalRate).toBeCloseTo(1700 / 850_000, 4);
    expect(file.states.SP).toBeGreaterThan(1);
    expect(file.states.PI).toBeLessThan(1);
  });

  it("estimates a year's premium from today's price, the rate and the state", () => {
    const insurance = {
      period: "2021A",
      source: "x",
      nationalRate: 0.03,
      nationalTheft: 37,
      states: { RJ: 1.3 },
      rate: 0.03,
      theft: 74,
      approx: false,
    };
    expect(estimateInsurance(100_000, insurance, "RJ")).toBeCloseTo(3900);
    expect(estimateInsurance(100_000, insurance, "XX")).toBeCloseTo(3000);
    // Intl puts a non-breaking space after "R$".
    expect(formatInsurance(100_000, insurance, "RJ").replace(/ /g, " ")).toBe("≈ R$ 3.900/ano (3,9% do valor)");
    expect(formatTheft(insurance)).toBe("74,0 por mil segurados/ano · 2,0× a média");
  });
});
