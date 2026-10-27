// Matches Renavam names ("CHEV/ONIX 10MT LT", "I/TOYOTA HILUX CD4X4 SRV") to
// the catalog's model lines (FIPE brand + family, e.g. "GM - Chevrolet" +
// "ONIX"). Renavam names are abbreviated and per registration, not per FIPE
// version, so the fleet is only counted per line: a popularity indicator,
// "fuzzy" by nature.

import type { CatalogFleetLine } from "../../src/catalog/fleet.ts";
import { brandNames } from "../wikidata/match.ts";

const compact = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

// Renavam brand codes that are not a FIPE brand name or alias.
const renavamBrands: Record<string, string> = {
  GM: "CHEVROLET",
  CHEV: "CHEVROLET",
  VOLKS: "VOLKSWAGEN",
  MBENZ: "MERCEDESBENZ",
  MMC: "MITSUBISHI",
  LR: "LANDROVER",
  LROVER: "LANDROVER",
  CAOACHERY: "CHERY",
  CAOACHANGAN: "CHANGAN",
};
// "I/TOYOTA COROLLA": imported, the brand comes after the slash.
const importPrefixes = new Set(["I", "IMP"]);

/** Brand group shared by FIPE brands that sell the same cars ("Caoa Chery", "Caoa Chery/Chery"). */
export function brandGroup(fipeBrand: string): string {
  return compact(brandNames[fipeBrand]?.[0] ?? fipeBrand);
}

export interface FleetLineSource {
  brand: string;
  family: string;
}

export interface FleetMatch {
  lines: CatalogFleetLine[];
  /** Line of each FIPE brand + family, by `${brand}\n${family}`. */
  lineOf: Map<string, number>;
  /** Vehicles of the catalog's brands that matched a line, and of those brands in all. */
  matched: number;
  brandTotal: number;
  /** Largest unmatched Renavam names of the catalog's brands, for review. */
  unmatched: [string, number][];
}

/**
 * Adds the fleet up per catalog line. A Renavam model belongs to the line
 * whose family is the longest prefix of its name: at a word boundary ("GOL
 * 1.0" → GOL), or glued when the family has 4+ characters ("HILUXSW4" →
 * HILUX, "HB20S" → HB20S before HB20).
 */
export function matchFleet(
  models: Record<string, Record<string, number>>,
  catalogLines: FleetLineSource[],
  /** Renavam name → state → vehicles (FleetFile.states). */
  states: Record<string, Record<string, number>> = {},
): FleetMatch {
  const groupAliases = new Map<string, string>(Object.entries(renavamBrands));
  const familiesByGroup = new Map<string, { key: string; family: string }[]>();
  const lineKeyOf = new Map<string, string>();
  for (const { brand, family } of catalogLines) {
    const group = brandGroup(brand);
    for (const name of [brand, ...(brandNames[brand] ?? [])]) groupAliases.set(compact(name), group);
    const key = compact(family);
    if (!key) continue;
    const families = familiesByGroup.get(group) ?? [];
    if (!families.some((item) => item.key === key)) families.push({ key, family });
    familiesByGroup.set(group, families);
    lineKeyOf.set(`${brand}\n${family}`, `${group}\n${key}`);
  }
  for (const families of familiesByGroup.values()) {
    families.sort((a, b) => b.key.length - a.key.length);
  }

  const totals = new Map<
    string,
    {
      family: string;
      years: Map<string, number>;
      total: number;
      imported: number;
      states: Map<string, number>;
    }
  >();
  const unmatched = new Map<string, number>();
  let matched = 0;
  let brandTotal = 0;

  for (const [name, years] of Object.entries(models)) {
    const slash = name.indexOf("/");
    if (slash < 0) continue;
    let prefix = name.slice(0, slash);
    let rest = name.slice(slash + 1).trim();
    const imported = importPrefixes.has(compact(prefix));
    if (imported) {
      const words = rest.split(" ");
      const two = compact(words.slice(0, 2).join(""));
      const take = groupAliases.has(two) && words.length > 2 ? 2 : 1;
      prefix = words.slice(0, take).join(" ");
      rest = words.slice(take).join(" ");
    }
    const group = groupAliases.get(compact(prefix));
    const families = group ? familiesByGroup.get(group) : undefined;
    if (!group || !families) continue;

    const total = Object.values(years).reduce((sum, count) => sum + count, 0);
    brandTotal += total;
    // "VW/NOVO GOL 1.0", "FIAT/NOVO UNO" are the same lines.
    const text = rest.toUpperCase().replace(/^(NOVO|NOVA|NEW) /, "");
    const key = compact(text);
    const found = families.find(({ key: family }) => {
      if (!key.startsWith(family)) return false;
      if (key.length === family.length || family.length >= 4) return true;
      // Short families must end at a word boundary: "UP" is not "UPGRADE".
      let letters = 0;
      for (let index = 0; index < text.length; index++) {
        if (/[A-Z0-9]/.test(text[index])) letters++;
        if (letters === family.length) return !/[A-Z0-9]/.test(text[index + 1] ?? " ");
      }
      return false;
    });
    if (!found) {
      unmatched.set(name, total);
      continue;
    }
    matched += total;
    const lineKey = `${group}\n${found.key}`;
    let line = totals.get(lineKey);
    if (!line) {
      totals.set(
        lineKey,
        (line = { family: found.family, years: new Map(), total: 0, imported: 0, states: new Map() }),
      );
    }
    line.total += total;
    if (imported) line.imported += total;
    for (const [state, count] of Object.entries(states[name] ?? {})) {
      line.states.set(state, (line.states.get(state) ?? 0) + count);
    }
    for (const [year, count] of Object.entries(years)) {
      line.years.set(year, (line.years.get(year) ?? 0) + count);
    }
  }

  const ranked = [...totals].sort(([, a], [, b]) => b.total - a.total);
  const lines: CatalogFleetLine[] = ranked.map(([, line], index) => ({
    family: line.family,
    total: line.total,
    rank: index + 1,
    years: Object.fromEntries([...line.years].sort(([a], [b]) => a.localeCompare(b))),
    imported: line.imported,
  }));
  // Rank per state among the same lines.
  const stateNames = new Set(ranked.flatMap(([, line]) => [...line.states.keys()]));
  for (const state of stateNames) {
    ranked
      .map(([, line], index) => ({ index, count: line.states.get(state) ?? 0 }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count)
      .forEach(({ index, count }, position) => {
        (lines[index].states ??= {})[state] = [count, position + 1];
      });
  }
  for (const line of lines) {
    if (line.states) line.states = Object.fromEntries(Object.entries(line.states).sort());
  }
  const indexOfKey = new Map(ranked.map(([key], index) => [key, index]));
  const lineOf = new Map<string, number>();
  for (const [catalogKey, lineKey] of lineKeyOf) {
    const index = indexOfKey.get(lineKey);
    if (index !== undefined) lineOf.set(catalogKey, index);
  }

  return {
    lines,
    lineOf,
    matched,
    brandTotal,
    unmatched: [...unmatched].sort(([, a], [, b]) => b - a).slice(0, 60),
  };
}
