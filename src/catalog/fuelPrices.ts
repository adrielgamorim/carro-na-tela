import type { Uf } from "./costs.ts";

/** Fuels the ANP survey covers among the ones used for cost per km. */
export type AnpFuel = "gasolina" | "etanol" | "diesel";

export type AnpPrices = Partial<Record<AnpFuel, number>>;

/**
 * public/catalog/fuel-prices.json, written by npm run fetch:anp: average pump
 * prices (R$/L) of the stations the ANP surveyed, per state and nationwide.
 */
export interface FuelPriceFile {
  version: 1;
  generatedAt: string;
  /** Survey week (Sunday to Saturday) of the newest data, ISO dates. */
  week: { from: string; to: string };
  national: AnpPrices;
  /** Each fuel comes from the newest week with data for that state. */
  states: Partial<Record<Uf, AnpPrices>>;
}

export const anpFuels: AnpFuel[] = ["gasolina", "etanol", "diesel"];

/** "18 a 24/10/2026" */
export function formatAnpWeek({ from, to }: FuelPriceFile["week"]): string {
  const [, fromMonth, fromDay] = from.split("-");
  const [toYear, toMonth, toDay] = to.split("-");
  return fromMonth === toMonth
    ? `${fromDay} a ${toDay}/${toMonth}/${toYear}`
    : `${fromDay}/${fromMonth} a ${toDay}/${toMonth}/${toYear}`;
}
