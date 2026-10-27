// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultFuelPrices } from "../catalog/costs";
import type { FuelPriceFile } from "../catalog/fuelPrices";
import { getCostSettings, resetCostSettingsStore, updateCostSettings } from "./costSettings";

const survey: FuelPriceFile = {
  version: 1,
  generatedAt: "2026-10-26T12:00:00.000Z",
  week: { from: "2026-10-18", to: "2026-10-24" },
  national: { gasolina: 6.52, etanol: 4.36, diesel: 7.34 },
  states: { SP: { gasolina: 6.38, etanol: 3.92, diesel: 7.33 }, AP: { gasolina: 6.39 } },
};

describe("cost settings", () => {
  beforeEach(() => {
    localStorage.clear();
    resetCostSettingsStore();
  });
  afterEach(() => localStorage.clear());

  it("uses the national defaults until the ANP survey is loaded", () => {
    expect(getCostSettings()).toMatchObject({ uf: "SP", prices: defaultFuelPrices, anp: null });
  });

  it("prefers typed prices, then the state's ANP average, then the national one", () => {
    resetCostSettingsStore(survey);
    expect(getCostSettings().prices).toEqual({ ...defaultFuelPrices, gasolina: 6.38, etanol: 3.92, diesel: 7.33 });

    updateCostSettings({ uf: "AP" });
    expect(getCostSettings().prices).toMatchObject({ gasolina: 6.39, etanol: 4.36, diesel: 7.34 });

    updateCostSettings({ prices: { etanol: 4.1 } });
    expect(getCostSettings()).toMatchObject({ custom: { etanol: 4.1 }, prices: { etanol: 4.1 } });

    updateCostSettings("reset");
    expect(getCostSettings()).toMatchObject({ uf: "AP", custom: {}, prices: { etanol: 4.36 } });
  });

  it("remembers the state and typed prices, and migrates the old format", () => {
    updateCostSettings({ uf: "RJ", prices: { gasolina: 6.9 } });
    resetCostSettingsStore();
    expect(getCostSettings()).toMatchObject({ uf: "RJ", custom: { gasolina: 6.9 } });

    localStorage.clear();
    localStorage.setItem(
      "carro-na-tela:custos:v1",
      JSON.stringify({ uf: "MG", prices: { ...defaultFuelPrices, diesel: 7.1 } }),
    );
    resetCostSettingsStore();
    expect(getCostSettings()).toMatchObject({ uf: "MG", custom: { diesel: 7.1 } });
  });
});
