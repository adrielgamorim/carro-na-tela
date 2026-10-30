// Renault's brochures (the PDFs linked from each vehicle of the press room,
// npm run fichas:renault). The recent Duster, Kardian and Kangoo ones have an
// "equipamentos" page laid out as a table: the versions as columns (their
// names over one or two lines, "Intense Plus" over "1.6 MT/CVT"), groups
// ("SEGURANÇA", "design interior") and items whose name may take several
// lines, with a mark per column: "•" standard, "O" optional, "–" not offered.
// The others list the equipment as text ("Zen", then "além da Life: …"),
// which this does not read.

import type { PdfTextLine } from "../inmetro/pbev.ts";
import type { EquipmentGroup, EquipmentList } from "./equipment.ts";
import { litersOf, plain, transmissionIn, turboIn, valvesIn, words } from "./open-sheets.ts";

/** "…/Catalogo-Kardian-mar24.pdf.asset.pdf/7560ab8ca2.pdf" → "catalogo-kardian-mar24.pdf"; undefined when not a PDF. */
export function brochureFile(url: string): string | undefined {
  const path = url.split(/[?#]/)[0]!;
  const name = path.match(/\/([^/]+?)\.pdf(?:\.asset\.pdf\/\w+\.pdf)?$/i)?.[1];
  if (!name) return undefined;
  return `${decodeURIComponent(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.pdf`;
}

/** The year a brochure is from: the site's folder ("/editorial/2025/") or its name ("marco-2021", "kangoo-24", "mar24"). */
export function brochureYear(url: string): number | undefined {
  const folder = url.match(/\/(20[12]\d)\//)?.[1];
  if (folder) return Number(folder);
  const name = brochureFile(url) ?? "";
  const full = name.match(/(?:^|-)(20[12]\d)(?:-|\.pdf)/)?.[1];
  if (full) return Number(full);
  const short = name.match(/[a-z-](2[0-9])(?:-\d)?\.pdf$/)?.[1];
  return short ? 2000 + Number(short) : undefined;
}

interface Cell {
  center: number;
  /** Where its text starts. */
  left: number;
  text: string;
}
interface Row {
  y: number;
  label: string;
  /** Column index → mark. */
  marks: Map<number, string>;
}

const standardMark = /^[•●▪■]$/;
const optionalMark = /^o$/i;
const absentMark = /^[-–—]$/;
const isMark = (text: string) => standardMark.test(text) || optionalMark.test(text) || absentMark.test(text);
const heading = /^((lista de )?equipamentos( e opcionais)?|ficha t[eé]cnica)$/i;
/** "• = série | O = opcional", "Série: •": the legend under the table. */
const legend = /= ?s[eé]rie|^s[eé]rie:|^n[aã]o dispon[ií]vel/i;
/** A name cut in the middle: a comma or a preposition at its end. */
const continues = /(,|(^|\s)(ao|à|aos|de|do|da|dos|das|e|com|para|em|no|na|por))$/i;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
const upperCase = (text: string) => /\p{L}{3}/u.test(text) && text === text.toUpperCase();

export interface BrochureColumn {
  /** The version's name, its header's lines joined: "Intense Plus 1.6 MT/CVT". */
  name: string;
  /** Where its marks are on the page (the first page's, when the table goes on). */
  center: number;
  page: number;
  groups: EquipmentGroup[];
}

/** The version columns of a brochure's equipment table, each with its standard and optional items. */
export function brochureColumns(lines: PdfTextLine[]): BrochureColumn[] {
  const sorted = [...lines].sort((a, b) => a.page - b.page || b.y - a.y);
  // Every "equipamentos" with a table under it (the Duster's first one opens a page of photos, and
  // its table goes on over two pages); the Stepway 2024's is in its "ficha técnica". With the spec
  // sheet on the left half ("ficha técnica | lista de equipamentos"), the heading nearest the table.
  const found: BrochureColumn[] = [];
  const pagesRead = new Set<number>();
  for (const start of sorted) {
    // A page's table once, whichever of its headings ("06. ficha técnica", "equipamentos") finds it.
    if (pagesRead.has(start.page)) continue;
    const page = sorted.filter((line) => line.page === start.page && line.y < start.y);
    for (const cell of cellsOf(start).filter((item) => heading.test(item.text)).reverse()) {
      const columns = tableUnder(page, cell.left - 320, start.page);
      if (!columns.length) continue;
      pagesRead.add(start.page);
      for (const column of columns) {
        const same = found.find((item) => plain(item.name) === plain(column.name));
        if (!same) found.push({ ...column, groups: [] });
        // A group may go on in the next column of the page or on the next page.
        const groups = (same ?? found.at(-1)!).groups;
        for (const group of column.groups) {
          const named = groups.find((item) => item.name === group.name);
          if (named) named.items.push(...group.items);
          else groups.push({ name: group.name, items: [...group.items] });
        }
      }
      break;
    }
  }
  return found;
}

function cellsOf(line: PdfTextLine): Cell[] {
  return line.cells
    .map((cell) => ({
      center: cell.center,
      left: cell.center - (cell.width ?? cell.text.trim().length * 4) / 2,
      text: cell.text.trim(),
    }))
    .filter((cell) => cell.text)
    .sort((a, b) => a.center - b.center);
}

/** The table on a page, its labels starting right of labelFrom (not the spec sheet beside it). */
function tableUnder(page: PdfTextLine[], labelFrom: number, pageNumber: number): BrochureColumn[] {
  // A row of the table: marks, every other cell to their left (not "• airbags", a list's bullet).
  const isTableRow = (cells: Cell[]) => {
    const marks = cells.filter((cell) => isMark(cell.text));
    return marks.length > 0 && cells.every((cell) => isMark(cell.text) || cell.center < marks[0]!.center);
  };
  const markCenters = page
    .map(cellsOf)
    .filter(isTableRow)
    .flatMap((cells) => cells.filter((cell) => isMark(cell.text)).map((cell) => cell.center))
    .sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const center of markCenters) {
    const last = clusters.at(-1);
    if (last && center - last.at(-1)! < 25) last.push(center);
    else clusters.push([center]);
  }
  const rowsWithMarks = page.map(cellsOf).filter(isTableRow).length;
  const columns = clusters
    .filter((cluster) => cluster.length >= Math.max(3, rowsWithMarks * 0.3))
    .map((cluster) => cluster.reduce((sum, x) => sum + x, 0) / cluster.length);
  if (!columns.length || rowsWithMarks < 5) return [];
  const columnOf = (center: number) => {
    const index = columns.findIndex((column) => Math.abs(column - center) < 40);
    return index;
  };
  const labelLimit = columns[0]! - 40;

  // The versions' names: the lines above the first mark, by column.
  const firstMark = page.find((line) => isTableRow(cellsOf(line)))!;
  // Rows labeled on the left ("MOTOR", "TRANSMISSÃO", "ANO MODELO") say other things than the name; "VERSÃO" does.
  const headerLines = page.filter((line) => {
    const cells = cellsOf(line);
    const label = cells.find((cell) => cell.center < labelLimit)?.text;
    return (
      line.y > firstMark.y &&
      (!label || /^vers/i.test(label)) &&
      cells.some((cell) => !isMark(cell.text) && columnOf(cell.center) >= 0)
    );
  });
  const names = columns.map((_, index) =>
    headerLines
      .flatMap((line) => cellsOf(line).filter((cell) => columnOf(cell.center) === index && !isMark(cell.text)))
      .map((cell) => cell.text)
      .join(" "),
  );
  const bodyTop = headerLines.length ? Math.min(...headerLines.map((line) => line.y)) : Infinity;

  // The body: label text and marks by line, until the legend.
  const body: Cell[][] = [];
  for (const line of page.filter((item) => item.y < bodyTop)) {
    const cells = cellsOf(line);
    if (cells.some((cell) => legend.test(cell.text))) break;
    body.push(cells);
  }
  // The names start at one x (their left margin); a spec sheet beside the table, at others.
  const isText = (cell: Cell) =>
    cell.center < labelLimit && cell.left > labelFrom && !isMark(cell.text) && !/^[®™]$/.test(cell.text);
  const margins = new Map<number, number>();
  for (const cell of body.flat().filter(isText)) {
    const bin = Math.round(cell.left / 4);
    margins.set(bin, (margins.get(bin) ?? 0) + 1);
  }
  const margin = 4 * ([...margins].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
  const raw: Row[] = [];
  for (const [index, line] of page.filter((item) => item.y < bodyTop).slice(0, body.length).entries()) {
    const cells = body[index]!;
    // From the cell at the margin on (a "®" set apart on the line under its name left out).
    const first = cells.findIndex((cell) => isText(cell) && Math.abs(cell.left - margin) <= 10);
    const label = first < 0 ? "" : cells.slice(first).filter(isText).map((cell) => cell.text).join(" ");
    const marks = new Map<number, string>();
    if (isTableRow(cells))
      for (const cell of cells.filter((item) => isMark(item.text))) {
        const column = columnOf(cell.center);
        if (column >= 0) marks.set(column, cell.text);
      }
    if (label || marks.size) raw.push({ y: line.y, label, marks });
  }
  // A mark split over two lines a point or two apart ("–" then "•") is one row.
  const markYs = raw.filter((row) => row.marks.size).map((row) => row.y);
  const rawPitch = median(markYs.slice(1).map((y, index) => markYs[index]! - y));
  const markRows: Row[] = [];
  for (const row of raw.filter((item) => item.marks.size)) {
    const last = markRows.at(-1);
    if (last && last.y - row.y < rawPitch * 0.2) for (const [column, mark] of row.marks) last.marks.set(column, mark);
    else markRows.push({ y: row.y, label: "", marks: new Map(row.marks) });
  }
  // A one-line item's height: the closest rows (the median would take the items of several lines).
  // Lines closer than that are one item's (Kwid's are 7 points apart, its items 8).
  const gaps = markRows.slice(1).map((row, index) => markRows[index]!.y - row.y).sort((a, b) => a - b);
  const pitch = gaps[0] ?? 0;

  // Blocks of lines closer than an item's pitch: one or more items, or a group's name.
  const blocks: Row[][] = [];
  for (const row of raw) {
    const last = blocks.at(-1);
    if (last && last.at(-1)!.y - row.y < pitch * 0.9) last.push(row);
    else blocks.push([row]);
  }
  const groups: { name: string; items: { name: string; marks: Map<number, string> }[] }[] = [];
  const group = () => {
    if (!groups.length) groups.push({ name: "Equipamentos", items: [] });
    return groups.at(-1)!;
  };
  for (const block of blocks) {
    const rows = markRows.filter((row) => row.y <= block[0]!.y && row.y >= block.at(-1)!.y);
    const labels = block.filter((row) => row.label);
    if (!rows.length) {
      const name = labels.map((row) => row.label).join(" ");
      // The last line of an item ("…integradas ao" / "multimídia e comando satélite de áudio"), not a group.
      const previous = groups.at(-1)?.items.at(-1);
      if (previous && /^\p{Ll}/u.test(name) && continues.test(previous.name)) previous.name += ` ${name}`;
      else if (name && name.length <= 60) groups.push({ name: sentenceCase(name), items: [] });
      continue;
    }
    // "SEGURANÇA" over the first item: the group's name.
    while (labels.length && upperCase(labels[0]!.label) && labels.length > rows.length) {
      groups.push({ name: sentenceCase(labels.shift()!.label), items: [] });
    }
    const texts = rows.map(() => [] as string[]);
    for (const label of labels) {
      const nearest = rows.reduce((best, row, index) =>
        Math.abs(row.y - label.y) < Math.abs(rows[best]!.y - label.y) ? index : best, 0);
      texts[nearest]!.push(label.label);
    }
    rows.forEach((row, index) => {
      const name = texts[index]!.join(" ").replace(/\s+/g, " ").replace(/\s+([,.)®])/g, "$1").trim();
      if (name) group().items.push({ name, marks: row.marks });
    });
  }

  return names.map((name, column) => ({
    name,
    center: columns[column]!,
    page: pageNumber,
    groups: groups
      .map((item) => ({
        name: item.name,
        items: item.items.flatMap((entry) => {
          // Kangoo's single column repeats each mark; "•" also stands for the merged columns.
          const mark = entry.marks.get(column) ?? "";
          if (standardMark.test(mark)) return [entry.name];
          if (optionalMark.test(mark)) return [`${entry.name} (opcional)`];
          return [];
        }),
      }))
      .filter((item) => item.items.length),
  }));
}

/** Renault's version names, to find them over their lists ("Life", "Zen 1.3 cvt"). */
const trimHeading =
  /^(life|zen|intense|iconic|outsider|techno|evolution|expression|authentique|dynamique|bose|premi[eè]re)\b[\w\s.,/-]{0,20}$/i;
const bullet = /^[•·●]$/;

/**
 * The equipment a brochure lists as text, version after version ("Life":
 * "• Direção eletro-hidráulica"…; "Zen": "além dos principais equipamentos da
 * versão Life, conta, ainda, com:" and its own): the page with the most
 * bullets, each item under the version name nearest above it and in line with
 * it, a name's next lines joined to it. A version that starts "além d…" or
 * "… e ainda" also has the one before's. With no version names (the Kwid
 * E-Tech's, of one version), one list with no name.
 */
export function brochureBullets(lines: PdfTextLine[]): BrochureColumn[] {
  interface Item {
    left: number;
    y: number;
    text: string;
  }
  const byPage = new Map<number, Item[]>();
  for (const line of lines) {
    const cells = cellsOf(line);
    cells.forEach((cell, index) => {
      // "• Direção…" as one cell, or "•" and the text in the next.
      const inline = cell.text.match(/^[•·●]\s+(.+)$/)?.[1];
      const next = bullet.test(cell.text) ? cells[index + 1] : undefined;
      const text = inline ?? (next && next.left - cell.left < 80 && !bullet.test(next.text) ? next.text : undefined);
      if (!text) return;
      const left = inline ? cell.left + (cell.text.length - inline.length) * 4 : next!.left;
      byPage.set(line.page, [...(byPage.get(line.page) ?? []), { left, y: line.y, text }]);
    });
  }
  // Of the pages that say "equipamentos" when some do (not the Koleos's in Spanish, "equipamientos", in the Captur's).
  const saysIt = new Set(lines.filter((line) => line.cells.some((cell) => /equipamentos/i.test(cell.text))).map((line) => line.page));
  const [page, items] = [...byPage]
    .filter(([number]) => !saysIt.size || saysIt.has(number))
    .sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!page || !items || items.length < 8) return [];
  const pageLines = lines.filter((line) => line.page === page).sort((a, b) => b.y - a.y);

  // A name's next lines: text a line below an item, starting where its text does.
  const ys = [...new Set(items.map((item) => item.y))].sort((a, b) => b - a);
  const gaps = ys.slice(1).map((y, index) => ys[index]! - y).filter((gap) => gap > 2).sort((a, b) => a - b);
  const lineGap = gaps[Math.floor(gaps.length / 2)] ?? 10;
  for (const line of pageLines) {
    for (const cell of cellsOf(line)) {
      if (bullet.test(cell.text) || /^[•·●]\s/.test(cell.text)) continue;
      const item = items.find(
        (open) => Math.abs(open.left - cell.left) <= 8 && open.y > line.y && open.y - line.y <= lineGap * 1.3,
      );
      if (!item || items.some((other) => other.y === line.y && Math.abs(other.left - cell.left) <= 8)) continue;
      item.text = `${item.text} ${cell.text}`;
      item.y = line.y;
    }
  }

  // The versions: their names on the page, and what each says before its list.
  const headings = pageLines.flatMap((line) =>
    cellsOf(line)
      .filter((cell) => trimHeading.test(cell.text))
      .map((cell) => ({ name: cell.text, center: cell.center, y: line.y })),
  );
  const named = headings.length
    ? headings.sort((a, b) => a.center - b.center)
    : [{ name: "", center: 0, y: Infinity }];
  const lists = named.map(() => [] as string[]);
  for (const item of items) {
    // The nearest name above, by how far it is across the page.
    const owner = named
      .map((heading, index) => ({ index, distance: Math.abs(heading.center - item.left) }))
      .filter(({ index }) => named[index]!.y > item.y)
      .sort((a, b) => a.distance - b.distance)[0];
    if (owner) lists[owner.index]!.push(item.text.replace(/\s+/g, " ").trim());
  }
  const pageText = pageLines.map((line) => cellsOf(line).map((cell) => cell.text).join(" ")).join(" ");
  return named.map((heading, index) => {
    // "além dos principais equipamentos da versão Life", "da série ZEN e ainda": the one before's too.
    const before = index > 0 && new RegExp(`(al[eé]m d[ao]s?[^.:]*|s[eé]rie\\s+)${plain(named[index - 1]!.name.split(" ")[0]!)}`, "i").test(plain(pageText));
    const items = [...new Set([...(before ? lists[index - 1]! : []), ...lists[index]!])];
    if (before) lists[index] = items;
    return { name: heading.name, center: heading.center, page, groups: items.length ? [{ name: "Equipamentos", items }] : [] };
  });
}

/** A brochure's equipment lists, one per version column, keyed like the spreadsheets' (renaultEquipment). */
export function renaultBrochureEquipment(
  lines: PdfTextLine[],
  link: { vehicle: string; brochure: string; page: string },
): EquipmentList[] {
  const year = brochureYear(link.brochure);
  const file = brochureFile(link.brochure);
  if (!year || !file) return [];
  // A table's columns, else the lists of a brochure that writes them as text.
  const columns = brochureColumns(lines).filter((column) => column.groups.length);
  return (columns.length ? columns : brochureBullets(lines)).flatMap(({ name, groups }) => {
    if (!groups.length) return [];
    const engines = name.match(/\d[.,]\d/g) ?? [];
    const liters = engines.length === 1 ? litersOf(name) : undefined;
    // "1.6 MT/CVT": both gearboxes, so neither.
    const both = /\bmt\s*\/\s*cvt\b/i.test(name);
    const transmission = both ? undefined : transmissionIn(name);
    const valves = engines.length === 1 ? valvesIn(name) : undefined;
    // "Zen 1.3 cvt" says nothing of the turbo FIPE's "1.3 TB" has: only a name that says it counts.
    const turbo = engines.length === 1 && (turboIn(name) || /\d\s*t\b/.test(plain(name)));
    const electric = /e-tech|z\.e\./i.test(link.vehicle);
    return [
      {
        brand: "renault" as const,
        line: link.vehicle,
        title: `${link.vehicle} ${year}${name ? ` · ${name}` : ""}`,
        trims: words(name).filter((word) => !/^\d|^(mt|at|cvt|t|turbo|tce|sce|flex)$/.test(word) && !/\//.test(word)),
        years: [year, year + 1] as [number, number],
        ...(liters !== undefined && { engineLiters: liters }),
        ...(valves && { valves }),
        ...(turbo && { turbo }),
        electric,
        ...(transmission && { transmission }),
        page: link.brochure.split("#")[0]!,
        file,
        groups,
      },
    ];
  });
}
