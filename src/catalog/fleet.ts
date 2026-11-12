// Senatran fleet (Renavam) per catalog model line, from npm run fetch:frota
// and build:catalog. Counts every vehicle of the line in circulation, all
// versions and years together: a popularity indicator. `sales` estimates the
// line's sales from its recent years of manufacture (scripts/frota/sales.ts).

/** One model line in the index (`CatalogIndexFile.fleet.lines`). */
export interface CatalogFleetLine {
  /** FIPE family, e.g. "ONIX". */
  family: string;
  total: number;
  /** 1 = the line with the most vehicles among the catalog's lines. */
  rank: number;
  /** Year of manufacture → vehicles. */
  years: Record<string, number>;
  /** Vehicles registered as imported ("I/" or "IMP/" in the Renavam name). */
  imported?: number;
  /** State → [vehicles, rank among the catalog's lines in that state]. */
  states?: Record<string, [number, number]>;
  /**
   * Sales estimated from the fleet (scripts/frota/sales.ts): vehicles made in
   * the reference year, and new ones registered in the reference month, each
   * ranked (1 = most) among the lines that sold any.
   */
  sales?: { year: number; yearRank?: number; month?: number; monthRank?: number };
}

export type Origin = "nacional" | "importado";

/** A line is imported when most of its fleet was registered as imported. */
export function fleetOrigin(line: CatalogFleetLine): Origin | null {
  if (line.imported === undefined || line.total === 0) return null;
  return line.imported / line.total >= 0.5 ? "importado" : "nacional";
}

export interface CatalogFleetInfo {
  /** "setembro de 2026" */
  reference: string;
  /** Lines ranked, for "12º de 480". */
  lineCount: number;
  /** "agosto de 2026": the month before, when `sales.month` exists. */
  previousReference?: string;
  line: CatalogFleetLine;
}

/** "setembro de 2026" → 2026, the year `sales.year` counts. */
export function fleetReferenceYear(reference: string): number | null {
  const match = /(\d{4})$/.exec(reference);
  return match ? Number(match[1]) : null;
}

/** "setembro de 2026" → "setembro", the month `sales.month` counts. */
export function fleetReferenceMonth(reference: string): string {
  return reference.replace(/ de \d{4}$/, "");
}

/** Vehicles of the line made in a year (Renavam counts the year of manufacture). */
export function fleetOfYear(info: CatalogFleetInfo, year: number | null): number | null {
  return year === null ? null : (info.line.years[String(year)] ?? null);
}

/** How the sales figures are estimated, for a tooltip. */
export function salesTitle(info: CatalogFleetInfo): string {
  const year = fleetReferenceYear(info.reference);
  return (
    `Estimativa pela frota da Senatran (${info.reference}), da linha ${info.line.family} toda: ` +
    `no ano, os veículos fabricados em ${year} já registrados; no mês, quanto cresceu a frota ` +
    `fabricada em ${year} e ${year === null ? "" : year - 1}` +
    (info.previousReference ? ` desde ${info.previousReference}` : "") +
    `. Não é o número oficial de emplacamentos.`
  );
}

/** "2,3 mi", "845 mil", "312" */
export function formatFleetCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (count >= 10_000) return `${Math.round(count / 1000).toLocaleString("pt-BR")} mil`;
  return count.toLocaleString("pt-BR");
}
