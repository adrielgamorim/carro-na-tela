// Equipment by version: Renault's lists ("LISTA DE EQUIPAMENTOS"), a table of
// items by version column, "l" or "▪" for standard and "-" for not offered,
// grouped under headings ("CONFORTO E CONVENIÊNCIA", "SEGURANÇA"). Matched to
// FIPE versions as the spec sheets are, but only where the version names the
// column's trim: equipment changes with the trim.

import { bestOfVersion, litersOf, plain, transmissionIn, turboIn, valvesIn, words } from "./open-sheets.ts";
import type { OpenSheetTarget, SheetKey } from "./open-sheets.ts";

export interface EquipmentGroup {
  /** "Conforto e conveniência" */
  name: string;
  items: string[];
}

/** One version column of a list (data/fichas/equipamentos.json). */
export interface EquipmentList extends SheetKey {
  /** "Logan · Zen 1.6 CVT" */
  title: string;
  page: string;
  file: string;
  /** Standard items; optional ones are marked "(opcional)". */
  groups: EquipmentGroup[];
}

export interface EquipmentFile {
  _doc?: string;
  lists: EquipmentList[];
}

const standard = /^(l|▪|■|•|●|x|s|sim)$/i;
const optional = /^(o|opc\.?|opcional)$/i;
/** "CONFORTO E CONVENIÊNCIA" → "Conforto e conveniência". */
const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

/**
 * The version columns of an equipment list. Header rows (no label, or
 * "Versões") name each column's trim and engine, an empty one repeating the
 * one on its left ("Zen" over "1.0 12V" and "1.6 CVT"); a row with only a
 * label is a group; the others are items. Its years: from the file's date
 * and the three after, since the lists last a few model years.
 */
export function renaultEquipment(
  rows: string[][],
  link: { vehicle: string; file: string | null; page: string },
  saved: Date | undefined,
): EquipmentList[] {
  if (!link.file || !saved) return [];
  // The old lists start every row with an empty column.
  const table = rows.every((row) => !row[0]) ? rows.map((row) => row.slice(1)) : rows;
  const headers: string[][] = [];
  const groups: { name: string; items: { name: string; cells: string[] }[] }[] = [];
  for (const row of table) {
    const [first = "", ...rest] = row;
    const filled = rest.filter(Boolean);
    if (/lista de equipamentos/i.test(row.join(" "))) continue;
    if ((!first || /^vers/i.test(first)) && filled.length && !groups.length) {
      headers.push(row);
    } else if (first && !filled.length) {
      if (!first.startsWith("*")) groups.push({ name: sentenceCase(first), items: [] });
    } else if (first && rest.some((cell) => standard.test(cell) || optional.test(cell) || cell === "-")) {
      if (!groups.length) groups.push({ name: "Equipamentos", items: [] });
      groups.at(-1)!.items.push({ name: first.replace(/\s+/g, " ").trim(), cells: rest });
    }
  }
  const columns = Math.max(0, ...headers.map((header) => header.length - 1));
  const year = saved.getFullYear();
  const lists: EquipmentList[] = [];
  for (let column = 0; column < columns; column++) {
    const name = headers
      .map((header) => header.slice(1, column + 2).reverse().find(Boolean) ?? "")
      .filter(Boolean)
      .join(" ");
    if (!name) continue;
    const listed = groups
      .map((group) => ({
        name: group.name,
        items: group.items.flatMap((item) => {
          const cell = item.cells[column]?.trim() ?? "";
          if (standard.test(cell)) return [item.name];
          if (optional.test(cell)) return [`${item.name} (opcional)`];
          return [];
        }),
      }))
      .filter((group) => group.items.length);
    if (!listed.length) continue;
    // "1.0 12V / 1.6 16V": two engines in one column say neither.
    const engines = name.match(/\d[.,]\d/g) ?? [];
    const liters = engines.length === 1 ? litersOf(name) : undefined;
    const transmission = transmissionIn(name) ?? (/\bat\b/.test(plain(name)) ? "automatico" : undefined);
    const valves = engines.length === 1 ? valvesIn(name) : undefined;
    lists.push({
      brand: "renault",
      line: link.vehicle,
      title: `${link.vehicle} · ${name}`,
      trims: words(name).filter((word) => !/^\d|^(mt|at|cvt|t|turbo|tce|sce|flex|versoes)$/.test(word)),
      years: [year, year + 3],
      ...(liters !== undefined && { engineLiters: liters }),
      ...(valves && { valves }),
      // "1.0 T MT": a T after the size is the turbo.
      ...(engines.length === 1 && { turbo: turboIn(name) || /\d\s*t\b/.test(plain(name)) }),
      electric: false,
      ...(transmission && { transmission }),
      page: link.page,
      file: link.file,
      groups: listed,
    });
  }
  return lists;
}

// Lists merged for versions that several fit as well, one object per set.
const merged = new Map<string, EquipmentList>();

/**
 * The equipment of a version-year: the list of its trim (see bestOfVersion);
 * several that fit as well ("Zen 1.0 12V / 1.6 16V" and "Zen 1.6 CVT" for an
 * engine they both name) give the items they all have.
 */
export function equipmentOfVersion(lists: EquipmentList[], target: OpenSheetTarget): EquipmentList | undefined {
  const tied = bestOfVersion(lists, target, { trimNamed: true });
  if (tied.length <= 1) return tied[0];
  const key = tied.map((list) => list.title).sort().join("\n");
  const known = merged.get(key);
  if (known) return known;
  const [first, ...others] = tied as [EquipmentList, ...EquipmentList[]];
  const everywhere = (item: string) => others.every((list) => list.groups.some((group) => group.items.includes(item)));
  const groups = first.groups
    .map((group) => ({ name: group.name, items: group.items.filter(everywhere) }))
    .filter((group) => group.items.length);
  const list: EquipmentList = { ...first, title: tied.map((item) => item.title).join(" / "), groups };
  merged.set(key, list);
  return list;
}
