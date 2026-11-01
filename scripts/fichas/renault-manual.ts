// Renault's owner's manuals (renault.com.br/manuais/<modelo>.html, npm run
// fichas:manuais): the "Características técnicas" chapter has a table of the
// engines, a column each ("1.0 16V Flex", "1.6 8V Flex" over "Manual",
// "Automatizado"), with the displacement, power and torque; a table of the
// weights, a column per version; and the dimensions as numbers on a drawing.
// The manuals go back to 2008, where the press room's spreadsheets do not.

import type { PdfTextCell, PdfTextLine } from "../inmetro/pbev.ts";
import { litersOf, plain, transmissionIn, turboIn, valvesIn, words } from "./open-sheets.ts";
import type { SheetSpecs } from "../../src/catalog/press.ts";
import type { OpenSheet } from "./open-sheets.ts";

export interface ManualSource {
  /** The FIPE line: "Sandero", "Duster Oroch". */
  line: string;
  years: [number, number];
  url: string;
  /** The model's page on renault.com.br, and the file in data/fichas/manuais. */
  page: string;
  file: string;
}

interface Column {
  center: number;
  title: string;
  /** Over several versions' titles ("2.0 16V 4x2", "2.0 16V 4x4"): their shared words only, and no gearbox. */
  merged?: boolean;
}
interface Row {
  label: string;
  y: number;
  /** By column. */
  values: Map<number, string>;
}

const textOf = (line: PdfTextLine) => line.cells.map((cell) => cell.text).join(" ");
const number = (text: string) => Number(text.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
const numbersIn = (text: string) => [...text.matchAll(/\d+(?:[.,]\d+)*/g)].map((match) => number(match[0]));
// A heading, not the chapter's table of contents ("Dimensões . . . . 6.05").
const isHeading = (line: PdfTextLine, pattern: RegExp) => pattern.test(textOf(line)) && !/\.\s?\.\s?\./.test(textOf(line));
const right = (cell: PdfTextCell) => cell.center + (cell.width ?? 0) / 2;
const isNumber = (cell: PdfTextCell) => /^\s*[\d<≤]/.test(cell.text);

/**
 * The cells of a line, with the pieces of a word as one: the Fluence 2010–12
 * set small capitals apart, touching ("c | ilindrada", "2.0 16 | v"), and a
 * thousand's digit a point off ("1 | 998", "6 | 000").
 */
export function joinedCells(line: PdfTextLine): PdfTextLine {
  const cells: PdfTextCell[] = [];
  // Those made of small capitals, whose next word a little apart is the same phrase ("2.0 16v | Hi-flex").
  const smallCaps = new Set<PdfTextCell>();
  for (const cell of [...line.cells].sort((a, b) => a.center - b.center)) {
    const last = cells.at(-1);
    const gap = last ? cell.center - (cell.width ?? 0) / 2 - right(last) : Infinity;
    const touching = gap < 0.5;
    const thousand = gap < 2 && /^\d$/.test(last?.text ?? "") && /^\d{3}\b/.test(cell.text);
    if (!last || !(touching || thousand || (gap < 3 && smallCaps.has(last)))) {
      cells.push(cell);
      continue;
    }
    const left = last.center - (last.width ?? 0) / 2;
    const width = right(cell) - left;
    // A word's first letter, written small but shown as a capital ("t | orque do motor" is "Torque do motor").
    const first = touching && /^\p{Ll}$/u.test(last.text) ? last.text.toUpperCase() : last.text;
    const joined = { center: left + width / 2, width, text: `${first}${touching || thousand ? "" : " "}${cell.text}` };
    if (touching || smallCaps.has(last)) smallCaps.add(joined);
    cells[cells.length - 1] = joined;
  }
  return cells.length === line.cells.length ? line : { ...line, cells };
}

/** A page's lines from the top, those a point or two apart as one ("998" a little below its row). */
function mergedLines(page: PdfTextLine[]): PdfTextLine[] {
  const out: PdfTextLine[] = [];
  for (const line of [...page].sort((a, b) => b.y - a.y)) {
    const last = out.at(-1);
    if (last && last.y - line.y <= 2) last.cells = [...last.cells, ...line.cells];
    else out.push({ ...line, cells: [...line.cells] });
  }
  return out;
}

const nearestColumn = (columns: Column[], center: number) =>
  columns.reduce((best, column, index) => (Math.abs(column.center - center) < Math.abs(columns[best]!.center - center) ? index : best), 0);

/** The rows of a table's page, each value under the column nearest it; the label is what is left of the first column. */
function tableRows(lines: PdfTextLine[], columns: Column[]): Row[] {
  const left = Math.min(...columns.map((column) => column.center)) - 35;
  return lines.map((line) => {
    const cells = [...line.cells].sort((a, b) => a.center - b.center);
    const values = new Map<number, string>();
    for (const cell of cells.filter((item) => item.center >= left)) {
      const nearest = nearestColumn(columns, cell.center);
      if (Math.abs(columns[nearest]!.center - cell.center) > 45) continue;
      values.set(nearest, [values.get(nearest), cell.text].filter(Boolean).join(" "));
    }
    return { label: cells.filter((cell) => cell.center < left).map((cell) => cell.text).join(" "), y: line.y, values };
  });
}

/**
 * A table: the columns of the numbers of the row whose label matches `key`
 * ("Cilindrada", "Massa do veículo vazio"), on its line or the nearest one,
 * and their titles from the rows between the heading and it.
 */
function table(page: PdfTextLine[], key: RegExp) {
  const lines = mergedLines(page);
  const keyIndex = lines.findIndex((line) => line.cells.some((cell) => key.test(plain(cell.text))));
  if (keyIndex < 0) return undefined;
  const keyLine = lines[keyIndex]!;
  const labelEnd = Math.max(...keyLine.cells.filter((cell) => !isNumber(cell)).map(right));
  // Not the unit's exponent, a cell of its own in the older manuals ("Cilindrada (cm ) | 3 | 998").
  const numbers = (line: PdfTextLine) => line.cells.filter((cell) => isNumber(cell) && cell.center > labelEnd && !/^\s*[23]\s*$/.test(cell.text));
  // Its own line, else the nearest with numbers: "Total | 1025" over "Massa do veículo vazio (tara)".
  const valueLine = [keyLine, ...lines.filter((line) => line !== keyLine && Math.abs(line.y - keyLine.y) <= 15).sort((a, b) => Math.abs(a.y - keyLine.y) - Math.abs(b.y - keyLine.y))].find(
    (line) => numbers(line).length,
  );
  if (!valueLine) return undefined;
  // With the numbers a few points off it ("Cilindrada | 1598" over a "998" 4 points lower).
  const columns: Column[] = lines
    .filter((line) => Math.abs(line.y - valueLine.y) <= 5)
    .flatMap(numbers)
    .sort((a, b) => a.center - b.center)
    .map((cell) => ({ center: cell.center, title: "" }));
  const heading = lines.findIndex((line) => /caracter[ií]sticas dos? motor(es)?|massas|pesos/i.test(textOf(line)));
  const left = Math.min(...columns.map((column) => column.center)) - 45;
  for (const line of lines.slice(heading + 1, keyIndex)) {
    // Not the engine codes, nor a row of values above the key's ("Total | 1025 | 1040").
    if (/tipo de motor|placa do motor|di[aâ]metro|curso/i.test(textOf(line)) || line.cells.some((cell) => /^\s*\d[\d.,]*\s*$/.test(cell.text))) continue;
    const byColumn = new Map<number, string[]>();
    // Not the notes over the table ("Os pesos indicados se referem a um veículo básico…").
    for (const cell of line.cells.filter((item) => item.center >= left && item.text.length <= 30).sort((a, b) => a.center - b.center)) {
      const index = nearestColumn(columns, cell.center);
      // A version between two engines' columns ("2.0 16V 4x2" of a 2.0 over three versions): theirs both, its words neither's.
      if (Math.abs(columns[index]!.center - cell.center) > 45) {
        for (const column of columns.filter((item) => Math.abs(item.center - cell.center) < 130)) column.merged = true;
        continue;
      }
      byColumn.set(index, [...(byColumn.get(index) ?? []), cell.text]);
    }
    for (const [index, texts] of byColumn) {
      const column = columns[index]!;
      if (texts.length > 1) column.merged = true;
      const shared = words(texts[0]!).filter((word) => texts.every((text) => words(text).includes(word)));
      column.title = `${column.title} ${texts.length > 1 ? shared.join(" ") : texts[0]}`.trim();
    }
  }
  return { columns, rows: tableRows(lines, columns) };
}

const fuelLabel = /^(gasolina|etanol|[aá]lcool|[/\s-])+$/i;
// The tare's row: "Massa do veículo vazio (tara)", or "Massa do veículo | Total" over "vazio (tara) em ordem".
const tareRow = /massa do veiculo|vazio|tara/;

/**
 * The values of a field by column: the rows labelled by it and the unlabelled
 * ones nearest it ("Gasolina / Etanol" lines, a label's second line: "em
 * ordem de marcha, sem motorista").
 */
function field(rows: Row[], pattern: RegExp): Map<number, string> {
  // Not a sub-label either: "Total", "Na frente", "Atrás" under "Massa do veículo".
  const ownLabel = (row: Row) =>
    row.label && !fuelLabel.test(row.label) && !/^[a-zà-ú(]/.test(row.label) && !/^(total|na frente|atr[aá]s)$/i.test(row.label.trim());
  const labelled = rows.filter(ownLabel);
  const out = new Map<number, string>();
  for (const row of rows) {
    if (!row.values.size) continue;
    const owner = ownLabel(row)
      ? row
        : labelled.reduce<Row | undefined>((best, item) => (!best || Math.abs(item.y - row.y) < Math.abs(best.y - row.y) ? item : best), undefined);
    if (!owner || !pattern.test(plain(owner.label)) || Math.abs(owner.y - row.y) > 25) continue;
    for (const [index, text] of row.values) out.set(index, [out.get(index), text].filter(Boolean).join(" "));
  }
  return out;
}

// The engine speeds: "@ 6.000", "/ 5.750", "a 4000", "a 4.000~5.000", "(5850 RPM)".
const rpm = String.raw`(?:\d{1,2}\.\d{3}|\d{4})`;
const withoutRpm = (text: string) =>
  text
    .replace(/\(\s*\d[\d.,]*\s*rpm\s*\)/gi, " ")
    .replace(new RegExp(String.raw`(?:@|/|\ba\b)\s*${rpm}(?:\s*(?:~|-|a)\s*${rpm})?(?:\s*rpm)?`, "gi"), " ");

/** "77 / 80 @ 6.000", "76/77 (5850 RPM)", "110 - 115 / 5.750", "118 a 5.500 (gasolina)": the largest power, in cv ("(kW @ rpm)": 88,25 kW is 120 cv). */
function powerOf(text: string, label: string): number {
  // "cv (kw)" over "180 (132,5)": the cv, the kW in brackets; "kW (cv)" over "92 (125)": the bracketed cv.
  const unit = plain(label);
  if (/kw\s*\(\s*cv/.test(unit)) {
    const bracketed = [...text.matchAll(/\(\s*(\d+(?:[.,]\d+)?)\s*(?:cv)?\s*\)/gi)].map((match) => number(match[1]!));
    if (bracketed.length) return Math.max(...bracketed);
  }
  const kw = /\bkw\b/.test(unit) && !/\bcv\b/.test(unit);
  const most = Math.max(0, ...numbersIn(withoutRpm(text.replace(/\(\s*\d[\d.,]*\s*\)/g, " "))).filter((value) => value >= (kw ? 30 : 40) && value <= 700));
  return kw ? Math.round(most * 1.35962) : most;
}

/** In m.kgf, or in N.m with the m.kgf in brackets ("97,3 (9,92) a 4350 RPM"), or in N.m alone. */
function torqueOf(text: string, label: string): number {
  const unit = plain(label);
  const bracketed = [...text.matchAll(/\((\d+[.,]\d+)\)/g)].map((match) => number(match[1]!));
  if (/kg/.test(unit) && bracketed.length) return Math.max(...bracketed);
  const values = numbersIn(withoutRpm(text.replace(/\([^)]*\)/g, " ")));
  if (/kg/.test(unit)) return Math.max(0, ...values.filter((value) => value >= 5 && value <= 100));
  const nm = values.filter((value) => value >= 50 && value <= 1000);
  return nm.length ? Math.round((Math.max(...nm) / 9.80665) * 10) / 10 : 0;
}

/** Length and wheelbase from the drawing's numbers, when every drawing agrees and none is another version's ("(*4091,4 mm)"). */
function dimensionsOf(pages: PdfTextLine[][]): Partial<Pick<SheetSpecs, "lengthMm" | "wheelbaseMm">> {
  const lengths = new Set<number>();
  const wheelbases = new Set<number>();
  for (const page of pages) {
    const text = page.map(textOf).join(" ");
    if (/\(\s*\*\s*[\d.,]+/.test(text)) return {};
    for (const cell of page.flatMap((line) => line.cells)) {
      const value = cell.text.match(/^\s*(\d+[.,]\d+)\s*(mm|m)?\s*$/);
      if (!value) continue;
      const meters = value[2] === "mm" || number(value[1]!) > 100 ? number(value[1]!) / 1000 : number(value[1]!);
      if (meters >= 3.3 && meters <= 5.6) lengths.add(Math.round(meters * 1000));
      if (meters >= 2.2 && meters <= 3.3) wheelbases.add(Math.round(meters * 1000));
    }
  }
  return {
    ...(lengths.size === 1 && { lengthMm: [...lengths][0]! }),
    ...(wheelbases.size === 1 && { wheelbaseMm: [...wheelbases][0]! }),
  };
}

/** The sheets of a manual, one per engine column (and gearbox, when the table splits them). */
export function renaultManualSheets(lines: PdfTextLine[], source: ManualSource): OpenSheet[] {
  const pages = new Map<number, PdfTextLine[]>();
  for (const line of lines.map(joinedCells)) pages.set(line.page, [...(pages.get(line.page) ?? []), line]);
  const pagesWith = (pattern: RegExp) => [...pages.values()].filter((page) => page.some((line) => isHeading(line, pattern)));
  const engines = pagesWith(/caracter[ií]sticas dos? motor(es)?/i)
    .map((page) => table(page, /^\s*cilindrada/))
    .find(Boolean);
  if (!engines) return [];
  const weights = pagesWith(/^\s*(massas|pesos)\b/i)
    .map((page) => table(page, tareRow))
    .find(Boolean);
  // The car's drawing, not the tyres' ("Dimensões dos pneus").
  const dimensions = dimensionsOf(pagesWith(/^\s*dimens[õo]es(?!.*(pneu|roda))/i));

  const displacement = field(engines.rows, /^cilindrada/);
  const labelOf = (pattern: RegExp) =>
    engines.rows
      .filter((row) => pattern.test(plain(row.label)))
      .map((row) => row.label)
      .join(" ");
  // Swapped when each label has the other's unit ("Torque máximo (kW @ rpm)", "Potência máxima (Nm @ rpm)"): the unit is right.
  const swapped = /\b(nm|kgf|mkg)\b/.test(plain(labelOf(/potencia/))) && /\b(kw|cv)\b/.test(plain(labelOf(/torque/)));
  const [powerName, torqueName] = swapped ? [/torque/, /potencia/] : [/potencia/, /torque/];
  const power = field(engines.rows, powerName);
  const torque = field(engines.rows, torqueName);
  const powerLabel = labelOf(powerName);
  const torqueLabel = labelOf(torqueName);
  const engineType = field(engines.rows, /tipo de motor/);
  const fuel = field(engines.rows, /tipo de combustivel|injecao/);
  const tare = weights && field(weights.rows, tareRow);

  const sheets: OpenSheet[] = [];
  engines.columns.forEach((column, index) => {
    // A merged column's gearbox is one of its versions' ("Automático" over the 2.0 4x2).
    // "2 299": the Master writes thousands with a space.
    const cc = numbersIn((displacement.get(index) ?? "").replace(/(\d) (?=\d{3}\b)/g, "$1"))[0];
    // Each word once: two title rows can repeat the engine ("1.6 16V" over "1.6 16V 4x2").
    const titleWords = column.title
      .replace(column.merged ? /\b(manual|autom[áa]tic[oa]|automatizad[oa]|cvt)\b\.?/gi : /$^/, "")
      .split(/\s+/)
      .filter(Boolean);
    const title =
      titleWords.filter((word, at) => titleWords.findIndex((other) => other.toLowerCase() === word.toLowerCase()) === at).join(" ") ||
      `${litersOf(`${cc} cm³`)?.toFixed(1) ?? ""}`;
    const engineLiters = cc ? litersOf(`${cc} cm³`) : litersOf(title);
    if (!engineLiters) return;
    // "Manual/Automatiz.": either.
    const both = /manual/i.test(title) && /autom|cvt/i.test(title);
    const transmission = column.merged || both ? undefined : transmissionIn(title);
    const valves = valvesIn(title);
    const diesel = /diesel/i.test(fuel.get(index) ?? "");
    // "(Stepway)": the Sandero's manual covers the Stepway, a line of its own.
    const line = /stepway/i.test(title) && !/stepway/i.test(source.line) ? `${source.line} Stepway` : source.line;
    // The weight of the version of this engine and gearbox with no other words ("1.6 8V Manual", not "1.6 8V Cross Manual").
    const own = new Set(words(`${line} ${title} flex manual automatizado automatico cvt 4x2`));
    const weight = (weights?.columns ?? [])
      .map((other, otherIndex) => ({ other, value: numbersIn(tare?.get(otherIndex) ?? "")[0] }))
      .filter(
        ({ other, value }) =>
          value &&
          litersOf(other.title) === engineLiters &&
          words(other.title).every((word) => own.has(word)) &&
          (!transmission || transmissionIn(other.title) === transmission),
      )
      .map(({ value }) => value!);
    const powerCv = powerOf(power.get(index) ?? "", powerLabel);
    const torqueKgfm = torqueOf(torque.get(index) ?? "", torqueLabel);
    const specs: SheetSpecs = {
      ...(powerCv > 0 && { powerCv }),
      ...(torqueKgfm > 0 && { torqueKgfm }),
      ...(new Set(weight).size === 1 && weight[0]! > 500 && weight[0]! < 4000 && { weightKg: weight[0]! }),
      ...dimensions,
    };
    if (!Object.keys(specs).length) return;
    sheets.push({
      brand: "renault",
      line,
      title: `${line} ${title} (manual ${source.years[0]})`,
      trims: [],
      years: source.years,
      engineLiters,
      ...(valves && { valves }),
      // A diesel's turbo left open, as FIPE does not always write it ("MASTER … 2.3 dCi").
      ...(diesel ? { diesel: true } : { turbo: turboIn(`${title} ${engineType.get(index) ?? ""}`) }),
      electric: false,
      ...(transmission && { transmission }),
      fallback: true,
      page: source.page,
      url: source.url,
      file: source.file,
      specs,
    });
  });
  return sheets;
}

/**
 * A power in kW where the label says cv (the Logan 2013's "56,6 / 58,8"
 * under "cv (rpm)"): in cv when the same engine's sheet of a year or two
 * away has 1.36 times as much.
 */
export function withPowerInCv(sheets: OpenSheet[]): OpenSheet[] {
  return sheets.map((sheet) => {
    const power = sheet.specs.powerCv;
    if (!power) return sheet;
    const inCv = Math.round(power * 1.35962);
    const near = sheets.some(
      (other) =>
        other !== sheet &&
        other.line === sheet.line &&
        other.engineLiters === sheet.engineLiters &&
        other.valves === sheet.valves &&
        Math.abs(other.years[0] - sheet.years[0]) <= 2 &&
        Math.abs((other.specs.powerCv ?? 0) - inCv) <= 1,
    );
    return near ? { ...sheet, specs: { ...sheet.specs, powerCv: inCv } } : sheet;
  });
}
