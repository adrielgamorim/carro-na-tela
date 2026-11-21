// FIPE prices kept month by month by build:catalog (scripts/catalog/price-history.ts),
// since the FIPE API gives only the last 3 months. Served per category and
// brand: public/catalog/historico/<category>-<brand code>.json.

import type { FipePriceHistory } from "../types/vehicle.ts";

export interface PriceHistoryFile {
  version: 1;
  /** FIPE reference code → "novembro de 2026". */
  months: Record<string, string>;
  /** Catalog version-year id ("56-10752:2024-1") → reference code → price in BRL. */
  prices: Record<string, Record<string, number>>;
}

/** How many months are kept: a year back from the latest, both ends included. */
export const historyMonths = 13;

/** "56-10752:2024-1" → "historico/cars-56.json" */
export function priceHistoryPath(category: string, id: string): string {
  return `historico/${category}-${id.split("-")[0]}.json`;
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** One version-year's months, in the FIPE API's shape, joined with the API's own (which win). */
export function mergePriceHistory(
  file: PriceHistoryFile | null,
  id: string,
  api: FipePriceHistory[],
): FipePriceHistory[] {
  const byReference = new Map<string, FipePriceHistory>();
  for (const [reference, value] of Object.entries(file?.prices[id] ?? {})) {
    byReference.set(reference, {
      reference,
      month: file?.months[reference] ?? reference,
      price: money.format(value),
    });
  }
  for (const item of api) byReference.set(item.reference, item);
  return [...byReference.values()].sort((a, b) => Number(b.reference) - Number(a.reference));
}
