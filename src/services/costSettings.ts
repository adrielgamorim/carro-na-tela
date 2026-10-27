import { useSyncExternalStore } from "react";
import { defaultFuelPrices, isUf } from "../catalog/costs";
import type { FuelPrices, Uf } from "../catalog/costs";
import type { FuelPriceFile } from "../catalog/fuelPrices";
import { requestJson } from "./http";

// The viewer's cost assumptions (state for IPVA and fuel, fuel prices for cost
// per km). Shared by every component through a tiny store; the state and the
// prices the viewer typed are remembered in localStorage as a per-viewer
// convenience. Prices not typed come from the ANP survey for the state
// (public/catalog/fuel-prices.json), else from the national defaults.

export interface CostSettings {
  uf: Uf;
  /** Prices in effect: typed by the viewer, else ANP for the state, else defaults. */
  prices: FuelPrices;
  /** Prices the viewer typed. */
  custom: Partial<FuelPrices>;
  /** ANP survey in use, once loaded; null when unavailable. */
  anp: FuelPriceFile | null;
}

interface Stored {
  uf: Uf;
  custom: Partial<FuelPrices>;
}

const storageKey = "carro-na-tela:custos:v2";
const legacyKey = "carro-na-tela:custos:v1";
const defaultStored: Stored = { uf: "SP", custom: {} };

function validPrices(raw: Partial<Record<keyof FuelPrices, unknown>> | undefined) {
  const prices: Partial<FuelPrices> = {};
  for (const key of Object.keys(defaultFuelPrices) as (keyof FuelPrices)[]) {
    const value = raw?.[key];
    if (typeof value === "number" && value > 0 && value < 100) prices[key] = value;
  }
  return prices;
}

function load(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<Stored> | null;
    if (raw) return { uf: isUf(raw.uf) ? raw.uf : defaultStored.uf, custom: validPrices(raw.custom) };

    // v1 stored every price; only the ones that differ from the old defaults were typed.
    const legacy = JSON.parse(localStorage.getItem(legacyKey) ?? "null") as
      | { uf?: unknown; prices?: Partial<FuelPrices> }
      | null;
    if (!legacy) return defaultStored;
    const custom = validPrices(legacy.prices);
    for (const key of Object.keys(custom) as (keyof FuelPrices)[]) {
      if (custom[key] === defaultFuelPrices[key]) delete custom[key];
    }
    return { uf: isUf(legacy.uf) ? legacy.uf : defaultStored.uf, custom };
  } catch {
    return defaultStored;
  }
}

let stored: Stored | undefined;
let anp: FuelPriceFile | null = null;
let anpRequested = false;
let snapshot: CostSettings | undefined;
const listeners = new Set<() => void>();

function compute(): CostSettings {
  stored ??= load();
  const survey = { ...anp?.national, ...anp?.states[stored.uf] };
  return {
    uf: stored.uf,
    prices: { ...defaultFuelPrices, ...survey, ...stored.custom },
    custom: stored.custom,
    anp,
  };
}

function notify() {
  snapshot = compute();
  for (const listener of listeners) listener();
}

const fuelPricesUrl = `${import.meta.env.BASE_URL}catalog/fuel-prices.json`;

/** Loads the ANP survey once; without it the national defaults stay. */
function loadAnp() {
  if (anpRequested) return;
  anpRequested = true;
  requestJson<FuelPriceFile>("Preços da ANP", fuelPricesUrl)
    .then((file) => {
      if (file.version !== 1) return;
      anp = file;
      notify();
    })
    .catch(() => {
      // Not generated yet (npm run fetch:anp) or offline: keep the defaults.
    });
}

export function getCostSettings(): CostSettings {
  snapshot ??= compute();
  return snapshot;
}

export function updateCostSettings(
  changes: { uf?: Uf; prices?: Partial<FuelPrices> } | "reset",
) {
  const base = stored ?? load();
  stored =
    changes === "reset"
      ? { uf: base.uf, custom: {} }
      : { uf: changes.uf ?? base.uf, custom: { ...base.custom, ...changes.prices } };
  try {
    localStorage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    // Storage may be blocked; the settings still apply for this visit.
  }
  notify();
}

function subscribe(listener: () => void) {
  loadAnp();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCostSettings(): CostSettings {
  return useSyncExternalStore(subscribe, getCostSettings, getCostSettings);
}

/** Test hook: forget the stored settings and the loaded survey. */
export function resetCostSettingsStore(survey: FuelPriceFile | null = null) {
  stored = undefined;
  anp = survey;
  anpRequested = survey !== null;
  snapshot = undefined;
}
