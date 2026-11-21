// Keeps the FIPE price of every version-year month by month in
// data/fipe/historico/<category>.json (the snapshots of past months may be
// gone; the FIPE API gives only 3 months), and slices it per brand for the
// site. Run by build:catalog.

import type { PriceHistoryFile } from "../../src/catalog/priceHistory.ts";
import { historyMonths, priceHistoryPath } from "../../src/catalog/priceHistory.ts";
import type { CrawlSnapshot } from "./catalog-index.ts";

export const emptyPriceHistory = (): PriceHistoryFile => ({ version: 1, months: {}, prices: {} });

/** Adds the snapshots' prices (a month seen again is replaced) and keeps the last `historyMonths`. */
export function mergeSnapshots(history: PriceHistoryFile, snapshots: CrawlSnapshot[]): PriceHistoryFile {
  const months = { ...history.months };
  const prices: PriceHistoryFile["prices"] = {};
  for (const [id, values] of Object.entries(history.prices)) prices[id] = { ...values };
  for (const snapshot of snapshots) {
    const reference = snapshot.reference;
    let priced = 0;
    for (const vehicle of snapshot.vehicles) {
      const value = vehicle.detail?.priceValue;
      if (!value) continue;
      (prices[vehicle.id] ??= {})[reference] = value;
      priced++;
    }
    if (priced > 0) months[reference] = snapshot.referenceMonth ?? months[reference] ?? reference;
  }
  // FIPE reference codes count months: keep the newest year and a month.
  const kept = Object.keys(months)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, historyMonths)
    .map(String);
  const keep = new Set(kept);
  const result: PriceHistoryFile = {
    version: 1,
    months: Object.fromEntries(kept.sort().map((reference) => [reference, months[reference]!])),
    prices: {},
  };
  for (const id of Object.keys(prices).sort()) {
    const values = Object.entries(prices[id]!).filter(([reference]) => keep.has(reference));
    if (values.length > 0) result.prices[id] = Object.fromEntries(values.sort(([a], [b]) => a.localeCompare(b)));
  }
  return result;
}

/** published path → the brand's part of the history. */
export function sliceByBrand(category: string, history: PriceHistoryFile): Map<string, PriceHistoryFile> {
  const slices = new Map<string, PriceHistoryFile>();
  for (const [id, values] of Object.entries(history.prices)) {
    const path = priceHistoryPath(category, id);
    let slice = slices.get(path);
    if (!slice) slices.set(path, (slice = { version: 1, months: history.months, prices: {} }));
    slice.prices[id] = values;
  }
  return slices;
}
