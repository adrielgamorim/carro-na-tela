import { isUf } from "../../src/catalog/costs.ts";
import type { Uf } from "../../src/catalog/costs.ts";
import { anpFuels } from "../../src/catalog/fuelPrices.ts";
import type { AnpFuel, AnpPrices, FuelPriceFile } from "../../src/catalog/fuelPrices.ts";

// Reads the ANP open-data CSVs of the last four survey weeks (one row per
// station, product and collection date) and averages the pump prices per
// state and week, the way the ANP weekly summary does.

export interface AnpSample {
  uf: Uf;
  fuel: AnpFuel;
  /** Sunday that starts the survey week, ISO date. */
  week: string;
  price: number;
}

// Regular gasoline and S10 diesel, the ones most cars use.
const products: Record<string, AnpFuel> = {
  GASOLINA: "gasolina",
  ETANOL: "etanol",
  "DIESEL S10": "diesel",
};

/** Sunday of the week of a dd/mm/yyyy date. */
export function surveyWeek(date: string): string | null {
  const match = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(date);
  if (!match) return null;
  const day = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day.toISOString().slice(0, 10);
}

/**
 * Samples of one CSV. Addresses may contain ";", so the product, date and
 * price are read from the end of the line (the last five columns are date,
 * sale price, purchase price, unit and brand).
 */
export function parseAnpCsv(text: string): AnpSample[] {
  const samples: AnpSample[] = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const columns = line.split(";");
    if (columns.length < 16) continue;
    const end = columns.length;
    const uf = columns[1].trim();
    const fuel = products[columns[end - 6].trim()];
    const week = surveyWeek(columns[end - 5].trim());
    const price = Number(columns[end - 4].trim().replace(",", "."));
    if (!isUf(uf) || !fuel || !week || !(price > 0)) continue;
    samples.push({ uf, fuel, week, price });
  }
  return samples;
}

const round = (value: number) => Math.round(value * 100) / 100;

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function summarizeFuelPrices(samples: AnpSample[], now = new Date()): FuelPriceFile {
  const week = samples.reduce((newest, sample) => (sample.week > newest ? sample.week : newest), "");
  if (!week) throw new Error("Nenhum preço da ANP nos arquivos");

  // Sum and count per state, fuel and week.
  const sums = new Map<string, { sum: number; count: number }>();
  for (const { uf, fuel, week: sampleWeek, price } of samples) {
    for (const key of [`${uf}|${fuel}|${sampleWeek}`, `BR|${fuel}|${sampleWeek}`]) {
      const total = sums.get(key) ?? { sum: 0, count: 0 };
      total.sum += price;
      total.count += 1;
      sums.set(key, total);
    }
  }
  const weeks = [...new Set(samples.map((sample) => sample.week))].sort().reverse();
  const newestAverage = (place: string, fuel: AnpFuel) => {
    for (const candidate of weeks) {
      const total = sums.get(`${place}|${fuel}|${candidate}`);
      if (total) return round(total.sum / total.count);
    }
    return undefined;
  };
  const pricesOf = (place: string): AnpPrices => {
    const prices: AnpPrices = {};
    for (const fuel of anpFuels) {
      const price = newestAverage(place, fuel);
      if (price !== undefined) prices[fuel] = price;
    }
    return prices;
  };

  const states: FuelPriceFile["states"] = {};
  for (const uf of [...new Set(samples.map((sample) => sample.uf))].sort()) {
    states[uf] = pricesOf(uf);
  }
  return {
    version: 1,
    generatedAt: now.toISOString(),
    week: { from: week, to: addDays(week, 6) },
    national: pricesOf("BR"),
    states,
  };
}
