// Safety and insurance of a version: its line's Latin NCAP crash test (npm
// run fetch:latinncap) and the insurance rate and thefts SUSEP's AUTOSEG
// gives for its FIPE code (npm run fetch:seguro).

/** A Latin NCAP test, as the catalog keeps it. */
export interface CatalogCrashTest {
  /** "Volkswagen Virtus + 4 Airbags" */
  title: string;
  year: number;
  /** The protocol's first year: 2010 and 2016 rate adult and child apart; 2020 on, one rating. */
  protocol: number;
  stars?: number;
  adultStars?: number;
  childStars?: number;
  /** Since 2020, in percent: adult, child, vulnerable road users, safety assist. */
  scores?: [number, number, number, number];
  url: string;
}

/** AUTOSEG's figures for the whole country, and each state's premiums against them. */
export interface InsuranceSource {
  /** Half year of the data ("2021A"). */
  period: string;
  source: string;
  nationalRate: number;
  nationalTheft: number;
  states: Record<string, number>;
}

/** A version's insurance figures. */
export interface CatalogInsurance extends InsuranceSource {
  /** Yearly premium over the insured value. */
  rate: number;
  /** Thefts per thousand vehicle-years. */
  theft: number;
  /** The line's figures, its own FIPE code having none (newer than the data). */
  approx: boolean;
}

export interface SafetyInfo {
  crash?: CatalogCrashTest;
  insurance?: CatalogInsurance;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const tenths = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** The yearly premium for a price in a state: the version's rate, the state's factor. */
export function estimateInsurance(price: number, insurance: CatalogInsurance, uf: string): number {
  return price * insurance.rate * (insurance.states[uf] ?? 1);
}

/** "≈ R$ 3.210/ano (3,2% do valor)". */
export function formatInsurance(price: number, insurance: CatalogInsurance, uf: string): string {
  const yearly = estimateInsurance(price, insurance, uf);
  const share = (insurance.rate * (insurance.states[uf] ?? 1) * 100).toFixed(1).replace(".", ",");
  return `≈ ${currency.format(Math.round(yearly / 10) * 10)}/ano (${share}% do valor)`;
}

/** "12,4 por mil por ano · 3× a média". */
export function formatTheft(insurance: CatalogInsurance): string {
  const ratio = insurance.theft / insurance.nationalTheft;
  const compared =
    ratio >= 1.25 ? `${tenths.format(ratio)}× a média` : ratio <= 0.8 ? `${tenths.format(ratio)}× a média (abaixo)` : "perto da média";
  return `${tenths.format(insurance.theft)} por mil segurados/ano · ${compared}`;
}

/** "5 estrelas (2024)", "adulto 3, criança 2 (2016)". */
export function formatCrashTest(test: CatalogCrashTest): string {
  const rating =
    test.stars !== undefined
      ? `${test.stars} ${test.stars === 1 ? "estrela" : "estrelas"}`
      : `adulto ${test.adultStars ?? "?"}, criança ${test.childStars ?? "?"} estrelas`;
  return `${rating} · teste de ${test.year}`;
}
