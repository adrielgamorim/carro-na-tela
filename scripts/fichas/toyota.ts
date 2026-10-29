// Toyota's spec sheets and equipment lists (PDFs the Wayback Machine kept of
// toyotacomunica.com.br, npm run fichas:wayback). Each is a table exported
// from a spreadsheet: a title ("COROLLA 2024 - FICHA TÉCNICA"), "Versão" and
// the versions' names (over one to three lines), then a label and the cells
// of its row. A merged cell covers several versions, its text centered over
// them ("204 / 3.400" for all but the GR-Sport). A value often sits on the
// line above its label ("2.745" then "Entre eixos (mm)"); in the lists, "•"
// (or a symbol font's check) is standard and "-" not offered.

import type { PdfTextLine } from "../inmetro/pbev.ts";
import type { EquipmentGroup, EquipmentList } from "./equipment.ts";
import { cabIn, lineWords, litersOf, plain, specsOfFields, transmissionIn, words } from "./open-sheets.ts";
import type { OpenSheet } from "./open-sheets.ts";

interface Cell {
  center: number;
  left: number;
  right: number;
  /** The line's height on the page. */
  y: number;
  text: string;
}

/** A line's text items as cells: words closer than a few points are one cell ("SRX Plus AT"). */
export function cellsOf(line: PdfTextLine): Cell[] {
  const items = [...line.cells]
    .map((cell) => {
      const width = cell.width ?? cell.text.length * 4;
      return { center: cell.center, left: cell.center - width / 2, right: cell.center + width / 2, y: line.y, text: cell.text.trim() };
    })
    .filter((cell) => cell.text)
    .sort((a, b) => a.left - b.left);
  const cells: Cell[] = [];
  for (const item of items) {
    const last = cells.at(-1);
    if (last && item.left - last.right < 4 && !isMark(item.text) && !isMark(last.text)) {
      last.text = `${last.text} ${item.text}`;
      last.right = item.right;
      last.center = (last.left + last.right) / 2;
    } else cells.push({ ...item });
  }
  return cells;
}

/** "•", or one character of a symbol font (a check drawn as a private-use glyph). */
const standardMark = (text: string) => /^[•●▪■✓✔]$/.test(text) || /^[-]$/.test(text);
const absentMark = (text: string) => /^[-─–—]$/.test(text);
const isMark = (text: string) => standardMark(text) || absentMark(text);

/**
 * Which value cell each column takes. With a cell per column, each its own;
 * with fewer, the cells split the columns into runs, in order, each cell
 * centered over its run (the merged cells of the spreadsheet), as closely as
 * the split allows.
 */
export function assignColumns(cells: Cell[], columns: number[]): number[] {
  const sorted = [...cells.keys()].sort((a, b) => cells[a]!.center - cells[b]!.center);
  const n = columns.length;
  const m = sorted.length;
  if (!m) return columns.map(() => -1);
  if (m >= n) {
    return columns.map((center) =>
      sorted.reduce((best, index) =>
        Math.abs(cells[index]!.center - center) < Math.abs(cells[best]!.center - center) ? index : best,
      ),
    );
  }
  const mean = (from: number, to: number) => columns.slice(from, to).reduce((sum, x) => sum + x, 0) / (to - from);
  // cost[i][j]: the best split of the first i columns among the first j cells.
  const cost = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(Infinity));
  const back = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  cost[0]![0] = 0;
  for (let j = 1; j <= m; j++) {
    for (let i = j; i <= n - (m - j); i++) {
      for (let k = j - 1; k < i; k++) {
        const total = cost[k]![j - 1]! + Math.abs(mean(k, i) - cells[sorted[j - 1]!]!.center);
        if (total < cost[i]![j]!) {
          cost[i]![j] = total;
          back[i]![j] = k;
        }
      }
    }
  }
  const owner = Array<number>(n).fill(-1);
  for (let i = n, j = m; j > 0; j--) {
    const k = back[i]![j]!;
    for (let column = k; column < i; column++) owner[column] = sorted[j - 1]!;
    i = k;
  }
  return owner;
}

export interface ToyotaFile {
  /** Its name in data/fichas/toyota ("2024-08-ficha-tecnica-hilux-2024-2.pdf"). */
  file: string;
  /** The archived copy, the source link. */
  url: string;
}

/** The line a file is of, by its name, as FIPE names it. */
export function toyotaLine(file: string): string | undefined {
  const name = file.toLowerCase();
  if (name.includes("corolla-cross")) return "Corolla Cross";
  if (name.includes("corolla")) return "Corolla";
  if (name.includes("sw4")) return "Hilux SW4";
  if (name.includes("hilux")) return "Hilux";
  if (name.includes("rav4")) return "RAV4";
  // FIPE names the sedan ("Sedan", "Sed.") but not the hatch.
  if (name.includes("yaris") && /seda/.test(name)) return "Yaris Sedan";
  if (name.includes("yaris")) return "Yaris";
  if (name.includes("camry")) return "Camry";
  return undefined;
}

/** The model year a file is of: its title's ("MY'22" too), else its name's ("hilux-2021", "sw4-my22"), else its upload's. */
export function toyotaYear(title: string, file: string): number | undefined {
  const inTitle = title.match(/\b(20[12]\d)\b/)?.[1] ?? title.match(/MY\s?'?(\d\d)\b/i)?.[1];
  if (inTitle) return inTitle.length === 2 ? 2000 + Number(inTitle) : Number(inTitle);
  const name = file.replace(/^\d{4}-\d\d-/, "");
  const inName = name.match(/(?:^|-)(20[12]\d)(?:-|$|\.)/)?.[1] ?? name.match(/my-?(\d\d)/)?.[1];
  if (inName) return inName.length === 2 ? 2000 + Number(inName) : Number(inName);
  const uploaded = file.match(/^(20\d\d)-/)?.[1];
  return uploaded ? Number(uploaded) : undefined;
}

interface Table {
  title: string;
  /** The versions' columns, empty for a sheet of one version. */
  versions: Cell[];
  /** Label and the value cells of its row. */
  rows: { label: string; cells: Cell[] }[];
  /** The lines after the header, as cells, for the lists. */
  body: Cell[][];
  /** Labels end before this. */
  labelLimit: number;
}

const joined = (cells: Cell[]) => cells.map((cell) => cell.text).join(" ");

/**
 * The table of a Toyota PDF. The versions: the cells of the "Versão" line and
 * of the label-less lines around it (names over several lines are joined by
 * column), not the group heading above them ("Híbridos | Combustão"). Value
 * cells on a line of their own wait for the next line with only a label.
 */
export function toyotaTable(lines: PdfTextLine[]): Table {
  // Cells a point or two apart are of one row ("204 / 3.400" just above "Potência … 224 / 3.000").
  const merged: PdfTextLine[] = [];
  for (const line of [...lines].sort((a, b) => a.page - b.page || b.y - a.y)) {
    const last = merged.at(-1);
    if (last && last.page === line.page && last.y - line.y <= 2) last.cells = [...last.cells, ...line.cells];
    else merged.push({ ...line, cells: [...line.cells] });
  }
  const sorted = merged.map(cellsOf).filter((cells) => cells.length);
  const title = sorted.map(joined).find((line) => /ficha t[eé]cnica|equipamentos/i.test(line) && /[a-z]{4}/i.test(line)) ?? "";
  const at = sorted.findIndex((cells) => /^vers(ao|oes)$/.test(plain(cells[0]?.text ?? "")));
  if (at < 0) return { title, versions: [], rows: rowsOf(sorted, 200, true), body: sorted, labelLimit: 200 };

  const labelEdge = sorted[at]![0]!.right + 20;
  // Not a group heading above the names ("Híbridos | Combustão"), a section below them
  // ("MOTORIZAÇÃO") or a value ("Dual VVT-I Flex 2.7 L 16V").
  const header = (cells: Cell[]) =>
    cells.every((cell) => cell.left > labelEdge) &&
    !/h[ií]brid|combust|diesel|^\d|\d[.,]\d|\d+v\b|motoriza|dimens|suspens|freios|pneus|conforto|seguran|estilo|equipamentos/i.test(joined(cells)) &&
    !cells.some((cell) => isMark(cell.text));
  const headerLines: Cell[][] = [sorted[at]!.slice(1)];
  if (at > 0 && header(sorted[at - 1]!) && sorted[at - 1]!.length <= 2) headerLines.unshift(sorted[at - 1]!);
  let end = at + 1;
  while (end < sorted.length && end <= at + 3 && header(sorted[end]!)) headerLines.push(sorted[end++]!);
  // One column per cluster of centers, its name the clustered texts top to bottom.
  const columns: Cell[] = [];
  for (const cell of headerLines.flat()) {
    const near = columns.find((column) => Math.abs(column.center - cell.center) < 18);
    if (near) {
      near.text = `${near.text} ${cell.text}`;
      near.left = Math.min(near.left, cell.left);
      near.right = Math.max(near.right, cell.right);
    } else columns.push({ ...cell });
  }
  columns.sort((a, b) => a.center - b.center);
  const labelLimit = Math.min(...columns.map((cell) => cell.left)) - 6;
  const body = sorted.slice(end);
  // Rows above the header count too ("Carroceria | Cabine Simples | Cabine Dupla").
  const before = sorted.slice(0, at).filter((cells) => !headerLines.includes(cells));
  return { title, versions: columns, rows: rowsOf([...before, ...body], labelLimit, false), body, labelLimit };
}

function rowsOf(lines: Cell[][], labelLimit: number, single: boolean): Table["rows"] {
  const rows: Table["rows"] = [];
  let pending: Cell[][] = [];
  for (const cells of lines) {
    const isLabel = (cell: Cell) => (single ? cell.center < labelLimit : cell.right <= labelLimit);
    const label = joined(cells.filter(isLabel));
    const values = cells.filter((cell) => !isLabel(cell));
    if (label && values.length) {
      // Its own cells first; a line just above fills the columns it leaves ("2.0L …" over "Motor 1.8L …").
      const above = single ? [] : pending.filter((line) => line[0]!.y - values[0]!.y <= 8);
      rows.push({ label, cells: valueLines([...above, values]) });
      pending = [];
    } else if (values.length) {
      pending.push(values);
    } else if (label) {
      rows.push({ label, cells: valueLines(pending) });
      pending = [];
    }
  }
  return rows;
}

/**
 * The cells of the value lines above a label, as one row: a row's values may
 * be split over lines ("2.0L …" for some versions, "1.8L …" for the others
 * a line below). Where they overlap, the nearest line with figures wins over
 * a note ("(abastecido 100% com etanol)").
 */
function valueLines(lines: Cell[][]): Cell[] {
  const order = [...lines].reverse().sort((a, b) => Number(/\d/.test(joined(b))) - Number(/\d/.test(joined(a))));
  const cells: Cell[] = [];
  for (const line of order) {
    for (const cell of line) {
      if (!cells.some((taken) => cell.left < taken.right && cell.right > taken.left)) cells.push(cell);
    }
  }
  return cells;
}

/** The text of a row for each version column ("" where none). */
function perVersion(table: Table, cells: Cell[]): string[] {
  if (!table.versions.length) return [joined(cells)];
  const owner = assignColumns(cells, table.versions.map((column) => column.center));
  return owner.map((index) => (index < 0 ? "" : cells[index]!.text));
}

const toyotaPage = "https://www.toyotacomunica.com.br/downloads/";
const notATrim = /^(\d.*|mt|at|a\/t|cvt|hybrid|lugares|assentos|cabine|simples|dupla|power|pack|std|pp|4x2|4x4|4×2|4×4)$/;
/**
 * A column's trim words, as FIPE writes them: "Cabine Simples" is "cs",
 * "GR-Sport" "grs"; not the line's own ("RAV4 XSE PHEV" is "xse", "phev").
 */
const trimsOf = (name: string, line: string) => {
  const ofLine = new Set(lineWords(line));
  const own = words(
    name
      .replace(/a\/t/gi, " ")
      .replace(/cabine simples/gi, " cs ")
      .replace(/cabine dupla/gi, " cd "),
  ).filter((word) => !notATrim.test(word) && !ofLine.has(word));
  return /\bgr-?s(port)?\b/i.test(name) ? [...own, "grs"] : own;
};

/** The sheets of a Toyota spec sheet, one per version column. */
export function toyotaSheets(lines: PdfTextLine[], source: ToyotaFile): OpenSheet[] {
  const line = toyotaLine(source.file);
  const table = toyotaTable(lines);
  const year = toyotaYear(table.title, source.file);
  // A list of equipment is not a spec sheet.
  if (!line || !year || (/equipamentos/i.test(table.title) && !/ficha t[eé]cnica/i.test(table.title))) return [];
  const columns = table.versions.length ? table.versions : [{ center: 0, left: 0, right: 0, y: 0, text: "" }];
  const rows = table.rows.map((row) => ({ label: row.label, values: perVersion(table, row.cells) }));
  const valueOf = (pattern: RegExp, column: number) =>
    rows
      .filter((row) => pattern.test(plain(row.label)))
      .map((row) => row.values[column] ?? "")
      .join(" ");
  // The engine's size, in the first row that names one ("2.0L Dual VVT-iE", "2.8L 16V Turbo").
  const engineRow = rows.find((row) => row.values.some((value) => /\d[.,]\d\s*l\b/i.test(value)));
  const sheets: OpenSheet[] = [];
  for (const [column, version] of columns.entries()) {
    // "204 / 3.400" under "Potência (cv/rpm)": the first figure, with its unit.
    const fields = rows.map((row) => {
      const value = row.values[column] ?? "";
      const label = plain(row.label);
      const first = value.match(/^\s*(\d[\d.,]*)/)?.[1];
      if (first && /\(cv/.test(label) && !/cv/i.test(value)) return { label: row.label, text: `${first} cv` };
      if (first && /\(kgf\.?m/.test(label) && !/kgf/i.test(value)) return { label: row.label, text: `${first} kgfm` };
      return { label: row.label, text: value };
    });
    const specs = specsOfFields(fields);
    if (!Object.keys(specs).length) continue;
    const engine = engineRow?.values[column] || valueOf(/^motor/, column);
    const liters = litersOf(engine.replace(/(\d[.,]\d)\s*l\b/i, "$1 "));
    const gearbox = `${valueOf(/transmiss|cambio|tipo\/especifica/, column)}`;
    const transmission = /\bmt\b/i.test(version.text) ? "manual" : /\bat\b|a\/t|cvt/i.test(version.text) ? "automatico" : transmissionIn(gearbox);
    const cab = cabIn(valueOf(/carroceria/, column));
    const hybrid = /hybrid|h[ií]brido|phev/i.test(`${version.text} ${engine} ${table.title}`);
    // FIPE writes the plug-in RAV4 as a hybrid; only its trim (XSE) tells them apart.
    const plugIn = /phev|plug-?in/i.test(`${version.text} ${table.title}`);
    const name = version.text || table.title.replace(/[-–]?\s*ficha t[eé]cnica\s*[-–]?/gi, " ").replace(/\s+/g, " ").trim();
    sheets.push({
      brand: "toyota",
      line,
      title: (name ? `${line} ${year} · ${name}` : `${line} ${year}`).replace(/\s+/g, " "),
      trims: trimsOf(version.text, line),
      years: [year, year + 1],
      ...(plugIn && trimsOf(version.text, line).length > 0 && { onlyNamed: true }),
      ...(liters !== undefined && { engineLiters: liters }),
      turbo: /turbo/i.test(engine),
      electric: false,
      ...(transmission && { transmission }),
      ...(cab && { cab }),
      ...(hybrid && { hybrid: true }),
      page: toyotaPage,
      url: source.url,
      file: source.file,
      specs,
    });
  }
  return sheets;
}

/**
 * The equipment lists of a Toyota list, one per version column. An item's
 * label may wrap: lines before its marks open it, a line after that starts
 * in lower case (or a parenthesis) closes it; a line in capitals is a group.
 * A list of one version with no marks says nothing it can be read by.
 */
export function toyotaEquipment(lines: PdfTextLine[], source: ToyotaFile): EquipmentList[] {
  const line = toyotaLine(source.file);
  const table = toyotaTable(lines);
  const year = toyotaYear(table.title, source.file);
  if (!line || !year || !table.versions.length || !/equipamentos/i.test(table.title)) return [];
  type Item = { name: string; marks: Cell[] };
  const groups: { name: string; items: Item[] }[] = [];
  let opening = "";
  for (const cells of table.body) {
    const marks = cells.filter((cell) => isMark(cell.text) && cell.left > table.labelLimit - 1);
    const text = joined(cells.filter((cell) => !marks.includes(cell) && cell.right <= table.labelLimit + 40)).trim();
    const values = cells.filter((cell) => !marks.includes(cell) && cell.right > table.labelLimit + 40);
    if (/^(legenda|std spec|item de s[eé]rie|novo item|dispon[ií]vel|n[aã]o dispon[ií]vel|n\/[ad]|vers[aã]o)/i.test(text)) continue;
    if (marks.length >= Math.min(2, table.versions.length)) {
      if (!groups.length) groups.push({ name: "Equipamentos", items: [] });
      groups.at(-1)!.items.push({ name: `${opening} ${text}`.trim(), marks });
      opening = "";
    } else if (!marks.length && !values.length && /^[A-ZÇÃÕÉÊÍÓÚÂ][A-ZÇÃÕÉÊÍÓÚÂ ,&/-]{3,}$/.test(text)) {
      // A group: capitals, words, no figures ("CONFORTO / CONVENIÊNCIA").
      groups.push({ name: text.charAt(0) + text.slice(1).toLowerCase(), items: [] });
      opening = "";
    } else if (!marks.length && /^[a-zà-ú(),]/.test(text) && groups.at(-1)?.items.length) {
      const items = groups.at(-1)!.items;
      items[items.length - 1]!.name += ` ${text}`;
    } else if (!marks.length && !values.length && text) {
      opening = `${opening} ${text}`.trim();
    } else {
      opening = "";
    }
  }
  const lists: EquipmentList[] = [];
  for (const [column, version] of table.versions.entries()) {
    const listed: EquipmentGroup[] = groups
      .map((group) => ({
        name: group.name,
        items: group.items
          .filter((item) => item.name && standardMark(perVersion(table, item.marks)[column] ?? ""))
          // Without the footnote number some start with ("14 Controle Eletrônico…").
          .map((item) => item.name.replace(/\s+/g, " ").replace(/^\d{1,2}\s+(?=\p{Lu})/u, "")),
      }))
      .filter((group) => group.items.length);
    if (!listed.length) continue;
    const hybrid = /hybrid|h[ií]brido|phev/i.test(`${version.text} ${table.title}`);
    lists.push({
      brand: "toyota",
      line,
      title: `${line} ${year} · ${version.text}`.replace(/\s+/g, " "),
      trims: trimsOf(version.text, line),
      years: [year, year + 1],
      electric: false,
      ...(hybrid && { hybrid: true }),
      ...(/\bmt\b/i.test(version.text) ? { transmission: "manual" as const } : /\bat\b|a\/t/i.test(version.text) ? { transmission: "automatico" as const } : {}),
      page: source.url,
      file: source.file,
      groups: listed,
    });
  }
  return lists;
}
