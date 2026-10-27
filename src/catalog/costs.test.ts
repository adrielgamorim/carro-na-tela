import { describe, expect, it } from "vitest";
import {
  costPerKm,
  defaultFuelPrices,
  estimateIpva,
  formatIpva,
  formatPerKm,
  ipvaRates,
  isUf,
  ufs,
} from "./costs";
import type { InmetroSpec } from "./inmetro";

function spec(overrides: Partial<InmetroSpec>): InmetroSpec {
  return {
    table: 2026,
    category: "Compacto",
    model: "ARGO",
    version: "DRIVE 1.3 AT",
    engine: "1.3-8V",
    size: "compacto",
    body: null,
    fourWheelDrive: false,
    propulsion: "combustao",
    fuel: "flex",
    transmission: "cvt",
    gears: 7,
    airConditioning: true,
    steering: "eletrica",
    consumption: {
      ethanolCity: 9,
      ethanolHighway: 10.3,
      fuelCity: 12.8,
      fuelHighway: 14.3,
      electricCity: null,
      electricHighway: null,
    },
    rangeKm: null,
    energyMjKm: 1.58,
    confidence: "exact",
    ...overrides,
  };
}

const prices = { gasolina: 6, etanol: 4, diesel: 7, energia: 1 };

describe("IPVA", () => {
  it("covers the 27 states with sane rates", () => {
    expect(ufs).toHaveLength(27);
    for (const uf of ufs) {
      const { min, max } = ipvaRates[uf];
      expect(min).toBeGreaterThan(1);
      expect(max).toBeLessThanOrEqual(5);
      expect(min).toBeLessThanOrEqual(max);
    }
    expect(isUf("SP")).toBe(true);
    expect(isUf("XX")).toBe(false);
  });

  it("estimates a value or a range", () => {
    expect(estimateIpva(100_000, "SP")).toEqual({ min: 4000, max: 4000 });
    expect(estimateIpva(100_000, "PR")).toEqual({ min: 1900, max: 1900 });
    expect(formatIpva(estimateIpva(90_100, "SP"))).toBe("R$ 3.604/ano");
    expect(formatIpva(estimateIpva(100_000, "RJ"))).toBe("R$ 3.000 a R$ 4.000/ano");
  });
});

describe("costPerKm", () => {
  it("weighs city and highway like INMETRO's combined figure", () => {
    const cost = costPerKm(spec({}), prices);
    // Gasoline: 1 / (0.55/12.8 + 0.45/14.3) = 13.44 km/l → R$ 6 / 13.44.
    expect(cost?.options[0].fuel).toBe("gasolina");
    expect(cost?.options[0].perKm).toBeCloseTo(0.4464, 3);
    // Ethanol: 1 / (0.55/9 + 0.45/10.3) = 9.55 km/l → R$ 4 / 9.55.
    expect(cost?.options[1]).toMatchObject({ fuel: "etanol" });
    expect(cost?.options[1].perKm).toBeCloseTo(0.4188, 3);
    expect(cost?.best.fuel).toBe("etanol");
  });

  it("uses diesel prices for diesel and energy use for electric cars", () => {
    const diesel = costPerKm(
      spec({
        fuel: "diesel",
        consumption: { ...spec({}).consumption, ethanolCity: null, ethanolHighway: null, fuelCity: 10, fuelHighway: 10 },
      }),
      prices,
    );
    expect(diesel?.best).toEqual({ fuel: "diesel", perKm: 0.7 });

    // 0.36 MJ/km = 0.1 kWh/km.
    const electric = costPerKm(spec({ propulsion: "eletrico", fuel: "eletrico", energyMjKm: 0.36 }), prices);
    expect(electric?.best.fuel).toBe("energia");
    expect(electric?.best.perKm).toBeCloseTo(0.1, 6);
    expect(formatPerKm(electric!.best)).toBe("R$ 0,10/km (eletricidade)");
  });

  it("returns null without INMETRO data or consumption", () => {
    expect(costPerKm(null, defaultFuelPrices)).toBeNull();
    expect(
      costPerKm(
        spec({
          consumption: {
            ethanolCity: null,
            ethanolHighway: null,
            fuelCity: null,
            fuelHighway: null,
            electricCity: null,
            electricHighway: null,
          },
        }),
        defaultFuelPrices,
      ),
    ).toBeNull();
  });
});
