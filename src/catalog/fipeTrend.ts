// How the FIPE price of a version has moved lately, from its monthly history
// (the FIPE API gives the last 3 months). FIPE is an average of prices
// researched over a month and published after it, so it lags the market:
// when it falls or rises fast, listings tend to be already below (or above)
// the table.

import { parseFipePrice } from "../services/fipeParsing";
import type { FipePriceHistory } from "../types/vehicle";

export interface FipeTrend {
  /** Percent change from the month before (null without it). */
  month: number | null;
  /** Percent change over the whole history, `months` long. */
  total: number;
  months: number;
  /** Month the history starts at ("setembro de 2026"). */
  since: string;
  /** A fast move, when the market likely leads the table. */
  signal: "queda" | "alta" | null;
}

/** Average monthly change beyond which the move is flagged; normal depreciation is ~1%/month. */
export const fallPerMonth = -1.5;
export const risePerMonth = 0.7;

export function fipeTrend(history: FipePriceHistory[]): FipeTrend | null {
  // FIPE reference codes count months: 339 is the month after 338.
  const points = history
    .map((item) => ({ reference: Number(item.reference), label: item.month, value: parseFipePrice(item.price) }))
    .filter((point) => point.value > 0 && Number.isFinite(point.reference))
    .sort((a, b) => a.reference - b.reference);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || first === last) return null;
  const change = (from: number) => ((last.value - from) / from) * 100;
  const previous = points.find((point) => point.reference === last.reference - 1);
  const months = last.reference - first.reference;
  const total = change(first.value);
  const perMonth = total / months;
  return {
    month: previous ? change(previous.value) : null,
    total,
    months,
    since: first.label,
    signal: perMonth <= fallPerMonth ? "queda" : perMonth >= risePerMonth ? "alta" : null,
  };
}
