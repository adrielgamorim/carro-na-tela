// Average yearly depreciation of a FIPE version, from its prices in the
// current reference month: a 2019 and a 2024 of the same version tell how much
// five more years cost. Only priced model years count; 0 km is left out (it
// carries the dealer margin).

export interface Depreciation {
  /** Average loss per year of age, 0–1. */
  perYear: number;
  fromYear: number;
  toYear: number;
}

export function versionDepreciation(
  prices: { modelYear: number | null; price: number | null }[],
): Depreciation | null {
  const priced = prices
    .filter((item): item is { modelYear: number; price: number } =>
      item.modelYear !== null && item.price !== null && item.price > 0,
    )
    .sort((a, b) => a.modelYear - b.modelYear);
  if (priced.length < 2) return null;
  const oldest = priced[0];
  const newest = priced.at(-1);
  if (!oldest || !newest) return null;
  const years = newest.modelYear - oldest.modelYear;
  if (years < 1) return null;
  const perYear = 1 - (oldest.price / newest.price) ** (1 / years);
  return { perYear, fromYear: oldest.modelYear, toYear: newest.modelYear };
}

/** "8,5% ao ano (2019 → 2024)" */
export function formatDepreciation({ perYear, fromYear, toYear }: Depreciation): string {
  const percent = (perYear * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${percent}% ao ano (${fromYear} → ${toYear})`;
}
