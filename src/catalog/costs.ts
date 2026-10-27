import type { InmetroSpec } from "./inmetro.ts";

// Ownership cost estimates: IPVA from the FIPE value and a state rate, and
// fuel cost per km from INMETRO consumption and editable fuel prices.

export type Uf =
  | "AC" | "AL" | "AM" | "AP" | "BA" | "CE" | "DF" | "ES" | "GO"
  | "MA" | "MG" | "MS" | "MT" | "PA" | "PB" | "PE" | "PI" | "PR"
  | "RJ" | "RN" | "RO" | "RR" | "RS" | "SC" | "SE" | "SP" | "TO";

/**
 * 2026 IPVA rates (%) for passenger cars. Where the rate depends on power or
 * fuel, or sources disagree, min and max differ and the estimate is a range.
 * Read in Oct/2026 from CNN Brasil and ValorFinal (which cites each Sefaz).
 */
export const ipvaRates: Record<Uf, { name: string; min: number; max: number }> = {
  AC: { name: "Acre", min: 2, max: 2 },
  AL: { name: "Alagoas", min: 2, max: 3.25 },
  AM: { name: "Amazonas", min: 1.5, max: 3 },
  AP: { name: "Amapá", min: 3, max: 3 },
  BA: { name: "Bahia", min: 2.5, max: 3 },
  CE: { name: "Ceará", min: 2.5, max: 3.5 },
  DF: { name: "Distrito Federal", min: 3, max: 3 },
  ES: { name: "Espírito Santo", min: 2, max: 2 },
  GO: { name: "Goiás", min: 3, max: 3.75 },
  MA: { name: "Maranhão", min: 2.5, max: 3 },
  MG: { name: "Minas Gerais", min: 3.5, max: 4 },
  MS: { name: "Mato Grosso do Sul", min: 3, max: 4.5 },
  MT: { name: "Mato Grosso", min: 2, max: 4 },
  PA: { name: "Pará", min: 2.5, max: 2.5 },
  PB: { name: "Paraíba", min: 2.5, max: 2.5 },
  PE: { name: "Pernambuco", min: 2.4, max: 2.4 },
  PI: { name: "Piauí", min: 2.5, max: 3 },
  PR: { name: "Paraná", min: 1.9, max: 1.9 },
  RJ: { name: "Rio de Janeiro", min: 3, max: 4 },
  RN: { name: "Rio Grande do Norte", min: 3, max: 3 },
  RO: { name: "Rondônia", min: 3, max: 3 },
  RR: { name: "Roraima", min: 3, max: 3 },
  RS: { name: "Rio Grande do Sul", min: 3, max: 3 },
  SC: { name: "Santa Catarina", min: 2, max: 2 },
  SE: { name: "Sergipe", min: 2.5, max: 3 },
  SP: { name: "São Paulo", min: 4, max: 4 },
  TO: { name: "Tocantins", min: 2.5, max: 3.5 },
};

export const ipvaNote =
  "Estimativa com alíquotas de 2026 para automóveis (out/2026) sobre o valor FIPE atual. " +
  "Os estados usam a própria tabela de valor venal e têm isenções (elétricos, idade, PcD) " +
  "não consideradas; o valor oficial é o do carnê.";

export const ufs = Object.keys(ipvaRates) as Uf[];

export function isUf(value: unknown): value is Uf {
  return typeof value === "string" && value in ipvaRates;
}

/** Yearly IPVA in R$ for a FIPE value; min equals max for single-rate states. */
export function estimateIpva(priceValue: number, uf: Uf): { min: number; max: number } {
  const { min, max } = ipvaRates[uf];
  return { min: (priceValue * min) / 100, max: (priceValue * max) / 100 };
}

export interface FuelPrices {
  gasolina: number;
  etanol: number;
  diesel: number;
  /** R$ per kWh charged. */
  energia: number;
}

/**
 * Fallback when public/catalog/fuel-prices.json (npm run fetch:anp) is missing:
 * national averages of the ANP survey of 11–17/10/2026; electricity (not in
 * the survey) is a typical home tariff and always comes from here.
 */
export const defaultFuelPrices: FuelPrices = {
  gasolina: 6.57,
  etanol: 4.47,
  diesel: 7.37,
  energia: 0.9,
};

export const energyPriceNote =
  "Energia: tarifa residencial típica (R$ 0,90/kWh); ajuste para a sua distribuidora.";

export type CostFuel = keyof FuelPrices;

export interface CostOption {
  fuel: CostFuel;
  /** R$ per km in mixed use. */
  perKm: number;
}

export interface CostPerKm {
  /** The cheapest option (a flex car picks the cheaper fuel). */
  best: CostOption;
  options: CostOption[];
}

// INMETRO's combined figure weighs 55% city and 45% highway driving.
const cityShare = 0.55;

function mixedKmPerLiter(city: number | null, highway: number | null): number | null {
  if (city !== null && highway !== null) {
    return 1 / (cityShare / city + (1 - cityShare) / highway);
  }
  return city ?? highway;
}

/** Fuel cost per km from INMETRO consumption; null without enough data. */
export function costPerKm(
  spec: InmetroSpec | null | undefined,
  prices: FuelPrices,
): CostPerKm | null {
  if (!spec) return null;
  const options: CostOption[] = [];
  const { consumption } = spec;

  if (spec.propulsion === "eletrico") {
    // MJ/km → kWh/km (1 kWh = 3.6 MJ).
    if (spec.energyMjKm) {
      options.push({ fuel: "energia", perKm: (spec.energyMjKm / 3.6) * prices.energia });
    }
  } else {
    const fuelKmL = mixedKmPerLiter(consumption.fuelCity, consumption.fuelHighway);
    const ethanolKmL = mixedKmPerLiter(consumption.ethanolCity, consumption.ethanolHighway);
    if (fuelKmL) {
      const fuel: CostFuel = spec.fuel === "diesel" ? "diesel" : "gasolina";
      options.push({ fuel, perKm: prices[fuel] / fuelKmL });
    }
    if (ethanolKmL) options.push({ fuel: "etanol", perKm: prices.etanol / ethanolKmL });
  }

  if (options.length === 0) return null;
  const best = options.reduce((cheapest, option) =>
    option.perKm < cheapest.perKm ? option : cheapest,
  );
  return { best, options };
}

const fuelNames: Record<CostFuel, string> = {
  gasolina: "gasolina",
  etanol: "etanol",
  diesel: "diesel",
  energia: "eletricidade",
};

const money = (fractionDigits: number) => {
  const format = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  // Plain spaces, as FIPE writes prices ("R$ 98.990,00").
  return { format: (value: number) => format.format(value).replace(/\s/g, " ") };
};

export function formatPerKm(option: CostOption): string {
  return `${money(2).format(option.perKm)}/km (${fuelNames[option.fuel]})`;
}

export function formatIpva({ min, max }: { min: number; max: number }): string {
  const format = (value: number) => money(0).format(value);
  return Math.round(min) === Math.round(max)
    ? `${format(min)}/ano`
    : `${format(min)} a ${format(max)}/ano`;
}
