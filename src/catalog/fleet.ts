// Senatran fleet (Renavam) per catalog model line, from npm run fetch:frota
// and build:catalog. Counts every vehicle of the line in circulation, all
// versions and years together: a popularity indicator, not a sales figure.

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
  line: CatalogFleetLine;
}

/** Vehicles of the line made in a year (Renavam counts the year of manufacture). */
export function fleetOfYear(info: CatalogFleetInfo, year: number | null): number | null {
  return year === null ? null : (info.line.years[String(year)] ?? null);
}

/** "2,3 mi", "845 mil", "312" */
export function formatFleetCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (count >= 10_000) return `${Math.round(count / 1000).toLocaleString("pt-BR")} mil`;
  return count.toLocaleString("pt-BR");
}
