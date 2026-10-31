// Honda's brochures (PDFs the Wayback Machine kept of honda.com.br, npm run
// fichas:wayback): most end with "Principais especificações", a table with the
// versions as columns ("LX | EX | EXL | Touring"), a label per row, and in each
// column a value ("1.5 L 16V…", "4.068"), "•" (standard) or "-" (not offered).
// Specs and equipment share the table: rows with figures are the sheet, the
// rest the equipment. Some put the table beside prose (the HR-V 2021's, on the
// right half of the page) or a version's value a point above the others' (the
// WR-V 2021's), and some carry their text twice.

import type { PdfTextLine } from "../inmetro/pbev.ts";
import type { EquipmentList } from "./equipment.ts";
import { litersOf, plain, specsOfFields, transmissionIn } from "./open-sheets.ts";
import type { OpenSheet } from "./open-sheets.ts";
import { assignColumns } from "./toyota.ts";

export interface HondaFile {
  file: string;
  /** The archived copy, the source link. */
  url: string;
}

interface Cell {
  center: number;
  left: number;
  right: number;
  y: number;
  text: string;
}

/** Honda's version names, as FIPE writes them. */
const trimWord = /^(dx|lx|ex|exl|lxs|lxr|exs|exr|lxl|sport|touring|personal\*?|advance|advanced|si|cx)$/i;
const titleWord = /especifica|ficha t[eé]cnica|honda|vers[aã]o/i;
// The WR-V 2025's mark is a lowercase "o" (a circle in its font).
const standard = /^[•●✓✔o]$/;
const absent = /^[-–—]$/;
// Rows that are the sheet's, not equipment.
const specRow =
  /^(motor|pot[eê]ncia|torque|tra[cç][aã]o|transmiss|c[aâ]mbio|suspens|dire[cç][aã]o|comprimento|largura|altura|dist[aâ]ncia entre|entre[- ]eixos|massa|peso|volume|porta-malas|tanque|capacidade|consumo|pneus|rodas|freios?|cilindrada|combust|velocidade|acelera|di[aâ]metro)/i;

// Of those, the ones that are never equipment, even with a "•" ("Suspensão dianteira - MacPherson").
const specOnly =
  /^(motor|pot[eê]ncia|torque|tra[cç][aã]o|suspens|comprimento|largura|altura|dist[aâ]ncia entre|entre[- ]eixos|massa|peso|volume|tanque|capacidade|consumo|cilindrada|di[aâ]metro|velocidade|acelera|[aâ]ngulos?|v[aã]o livre)/i;

// The file's line, as FIPE names it; the order matters ("city hatch" before "city").
const lines: [RegExp, string][] = [
  [/wr-?v/, "WR-V"],
  [/hr-?v/, "HR-V"],
  [/zr-?v/, "ZR-V"],
  [/cr-?v/, "CR-V"],
  [/city.*hatch|hatchback/, "City Hatchback"],
  [/city/, "City Sedan"],
  [/civic/, "Civic Sedan"],
  [/\bfit/, "Fit"],
  [/accord/, "Accord Sedan"],
];

/** The line of a Honda file, from its name ("honda-campanha-hrv2021-…" → "HR-V"). */
export function hondaLine(file: string): string | undefined {
  return lines.find(([pattern]) => pattern.test(file.toLowerCase()))?.[1];
}

/** Its model year: the name's ("…hrv2021…", "city-2015"), else the table title's ("Honda City - 2014"). */
export function hondaYear(file: string, title = ""): number | undefined {
  const year = file.match(/(?<!\d)(20[12]\d)(?!\d)/)?.[1] ?? title.match(/(?<!\d)(20[12]\d)(?!\d)/)?.[1];
  return year ? Number(year) : undefined;
}

function cellsOf(line: PdfTextLine): Cell[] {
  const cells: Cell[] = [];
  for (const cell of [...line.cells].sort((a, b) => a.center - b.center)) {
    const text = cell.text.trim();
    if (!text) continue;
    // The text layer twice: a cell at the same place with the same text.
    if (cells.some((taken) => taken.text === text && Math.abs(taken.center - cell.center) < 3)) continue;
    const width = cell.width ?? text.length * 4;
    cells.push({ center: cell.center, left: cell.center - width / 2, right: cell.center + width / 2, y: line.y, text });
  }
  return cells;
}

/** The lines of a page, those a point or two apart as one (a version's value just above the others'). */
function mergedLines(lines: PdfTextLine[]): Cell[][] {
  const merged: PdfTextLine[] = [];
  for (const line of [...lines].sort((a, b) => a.page - b.page || b.y - a.y)) {
    const last = merged.at(-1);
    if (last && last.page === line.page && last.y - line.y <= 2) last.cells = [...last.cells, ...line.cells];
    else merged.push({ ...line, cells: [...line.cells] });
  }
  return merged.map((line) => cellsOf(line)).filter((cells) => cells.length);
}

interface HondaColumn {
  trim: string;
  /** Label → value ("•", "-", "1.5 L 16V…"). */
  values: { label: string; group: string; value: string }[];
}

/** The table's columns, each with its rows' values. */
export function hondaColumns(pdfLines: PdfTextLine[]): { title: string; columns: HondaColumn[] } {
  for (const page of new Set(pdfLines.map((line) => line.page))) {
    const rows = mergedLines(pdfLines.filter((line) => line.page === page));
    // The header: version names, and at most a title on their left (prose further left is another column of the page).
    const at = rows.findIndex((cells) => {
      const trims = cells.filter((cell) => trimWord.test(cell.text));
      const others = cells.filter((cell) => !trimWord.test(cell.text));
      return (
        trims.length >= 2 &&
        others.every((cell) => cell.right < trims[0]!.left && (titleWord.test(cell.text) || trims[0]!.left - cell.right > 300))
      );
    });
    if (at < 0) continue;
    const header = rows[at]!;
    const title = header
      .filter((cell) => !trimWord.test(cell.text) && titleWord.test(cell.text))
      .map((cell) => cell.text)
      .join(" ");
    const trims = header.filter((cell) => trimWord.test(cell.text));
    const centers = trims.map((cell) => cell.center);
    const valuesFrom = Math.min(...trims.map((cell) => cell.left)) - 20;

    const columns: HondaColumn[] = trims.map((cell) => ({ trim: cell.text.replace(/\*$/, ""), values: [] }));
    let group = "";
    for (const cells of rows.slice(at + 1)) {
      const values = cells.filter((cell) => cell.center >= valuesFrom);
      // The label: the cell nearest the columns and those right next to it (not prose further left).
      const left = cells.filter((cell) => cell.center < valuesFrom).reverse();
      const label: Cell[] = [];
      for (const cell of left) {
        if (label.length && label.at(-1)!.left - cell.right > 30) break;
        label.push(cell);
      }
      const text = label.reverse().map((cell) => cell.text).join(" ").replace(/\s+/g, " ").trim();
      if (!values.length) {
        // A row without values in the table's area: a group ("SEGURANÇA").
        if (text && text.length <= 40 && text === text.toUpperCase() && /\p{L}{4}/u.test(text)) group = text;
        continue;
      }
      // Not a footnote ("6) O ajuste automático dos faróis pode não funcionar…").
      if (!text || /^\d+\)/.test(text) || text.length > 160) continue;
      const owner = assignColumns(values, centers);
      owner.forEach((index, column) => {
        if (index >= 0) columns[column]!.values.push({ label: text, group, value: values[index]!.text });
      });
    }
    if (columns.some((column) => column.values.length >= 5)) return { title, columns };
  }
  return { title: "", columns: [] };
}

const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

/** A Honda brochure's sheet and equipment list per version. */
export function hondaBrochure(pdfLines: PdfTextLine[], source: HondaFile): { sheets: OpenSheet[]; lists: EquipmentList[] } {
  const { title, columns } = hondaColumns(pdfLines);
  // The name says the line, or the table's title does ("Principais Especificações Honda Fit").
  const line = hondaLine(source.file) ?? hondaLine(title);
  const year = hondaYear(source.file, title);
  if (!line || !year || !columns.length) return { sheets: [], lists: [] };
  const sheets: OpenSheet[] = [];
  const lists: EquipmentList[] = [];
  for (const { trim, values } of columns) {
    const value = (pattern: RegExp) => values.find((row) => pattern.test(plain(row.label)))?.value ?? "";
    const engine = value(/^motor/);
    const gearbox = `${value(/^(transmiss|cambio)/)} ${values.find((row) => /^(transmiss|cambio)/.test(plain(row.label)))?.label ?? ""}`;
    const liters = litersOf(engine);
    const transmission = transmissionIn(gearbox);
    const key = {
      brand: "honda" as const,
      line,
      trims: [plain(trim)],
      // A brochure also serves the next model year (the WR-V 2025's is the 2026 FIPE lists); the nearest wins.
      years: [year, year + 1] as [number, number],
      ...(liters !== undefined && { engineLiters: liters }),
      turbo: /turbo/i.test(engine),
      electric: false,
      ...(/h[ií]brid|e:hev/i.test(engine) && { hybrid: true }),
      ...(transmission && { transmission }),
    };
    const name = `${line} ${year} · ${trim}`;
    // The figures: the rows that name a spec, their value with the label's unit ("4.068" under "Comprimento (mm)").
    const fields = values
      .filter((row) => specRow.test(row.label) && !standard.test(row.value) && !absent.test(row.value))
      .map((row) => ({ label: row.label, text: withUnit(row.label, row.value) }));
    const specs = specsOfFields(fields);
    if (Object.keys(specs).length) sheets.push({ ...key, title: name, page: source.url, url: source.url, file: source.file, specs });

    // The equipment: the other rows a version has ("•", or a value such as "em LED").
    const groups: { name: string; items: string[] }[] = [];
    for (const row of values) {
      if (absent.test(row.value) || /^cores?$|^cores? /i.test(row.group)) continue;
      if (specOnly.test(row.label) || (specRow.test(row.label) && !standard.test(row.value))) continue;
      const item = standard.test(row.value) ? row.label : `${row.label}: ${row.value}`;
      const groupName = row.group ? sentenceCase(row.group) : "Equipamentos";
      const group = groups.find((item) => item.name === groupName) ?? groups[groups.push({ name: groupName, items: [] }) - 1]!;
      if (!group.items.includes(item)) group.items.push(item);
    }
    if (groups.length) lists.push({ ...key, title: name, page: source.url, file: source.file, groups });
  }
  return { sheets, lists };
}

/** "4.068" under "Comprimento (mm)" → "4.068 mm"; "115 / 6000 - 116 / 6000" under "Potência (cv / rpm)" → "115 cv". */
export function withUnit(label: string, value: string): string {
  const unit = label.match(/\((cv|kgf\.?m|kgm|mm|kg|l|litros|km\/h|s)\b/i)?.[1]?.toLowerCase();
  if (!unit || /[a-z]/i.test(value.replace(/rpm|@|gasolina|etanol|\(|\)|[eg]\b/gi, ""))) return value;
  const first = value.match(/\d+(?:[.,]\d+)*/)?.[0];
  if (!first) return value;
  const units: Record<string, string> = { cv: "cv", "kgf.m": "kgfm", kgfm: "kgfm", kgm: "kgfm", mm: "mm", kg: "kg", l: "litros", litros: "litros", "km/h": "km/h", s: "s" };
  return `${first} ${units[unit] ?? unit}`;
}
