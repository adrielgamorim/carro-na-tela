import { describe, expect, it } from "vitest";
import { mergePriceHistory, priceHistoryPath } from "./priceHistory";

describe("priceHistory", () => {
  it("serves each brand from its own file", () => {
    expect(priceHistoryPath("cars", "56-10752:2024-1")).toBe("historico/cars-56.json");
  });

  it("joins the kept months with the API's, the API winning", () => {
    const file = {
      version: 1 as const,
      months: { "337": "setembro de 2026", "338": "outubro de 2026" },
      prices: { "56-1:2024-1": { "337": 100_000, "338": 99_000 } },
    };
    const api = [{ reference: "338", month: "outubro de 2026", price: "R$ 98.000,00" }];
    expect(mergePriceHistory(file, "56-1:2024-1", api)).toEqual([
      { reference: "338", month: "outubro de 2026", price: "R$ 98.000,00" },
      { reference: "337", month: "setembro de 2026", price: "R$\u00a0100.000,00" },
    ]);
    expect(mergePriceHistory(null, "x", api)).toEqual(api);
  });
});
