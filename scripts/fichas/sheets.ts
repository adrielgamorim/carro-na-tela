// Spec sheets ("fichas técnicas") of Stellantis Brasil: their links, the
// fields read from the PDFs, and how a sheet is matched to FIPE versions.

import type { SheetSpecs } from "../../src/catalog/press.ts";

/** A sheet as listed on a model-year page of the press room. */
export interface SheetLink {
  /** Press room brand ("fiat", "jeep"…). */
  brand: string;
  /** The model-year page it is on. */
  page: string;
  pageTitle: string;
  modelYear: number | null;
  /** Document id in /br-pt/download-model-document/<id>. */
  id: number;
  /** The version ("Pulse Audace Turbo 200 Flex Automático"); empty for some. */
  title: string;
  url: string;
}

export interface SheetLinksFile {
  generatedAt: string;
  links: SheetLink[];
}

/** A sheet read from its PDF (data/fichas/fichas.json). */
export interface ReadSheet {
  /** The document id of its link. */
  id: number;
  brand: string;
  /** The model-year page's title ("Fiat Pulse MY27"): its line. */
  pageTitle: string;
  title: string;
  modelYear: number | null;
  /** Model-year page and the PDF's link, the sources shown in the app. */
  page: string;
  url: string;
  /** The PDF's file name in data/fichas/pdf. */
  file: string;
  specs: SheetSpecs;
}

export interface ReadSheetsFile {
  _doc?: string;
  sheets: ReadSheet[];
}

const slug = (text: string) => plain(text).replace(/[^a-z0-9]+/g, "");

/**
 * The links in the checklist's order (data/fichas/lista.html): by brand as
 * listed, newest model year first, then as each page lists them. Its position
 * numbers the checklist and the files downloaded from it.
 */
export function checklistOrder(links: SheetLink[]): SheetLink[] {
  const byBrand = new Map<string, Map<string, SheetLink[]>>();
  for (const link of links) {
    if (!byBrand.has(link.brand)) byBrand.set(link.brand, new Map());
    const pages = byBrand.get(link.brand)!;
    pages.set(link.pageTitle, [...(pages.get(link.pageTitle) ?? []), link]);
  }
  return [...byBrand.values()].flatMap((pages) =>
    [...pages.values()]
      .sort((a, b) => (b[0]?.modelYear ?? 0) - (a[0]?.modelYear ?? 0) || a[0]!.pageTitle.localeCompare(b[0]!.pageTitle))
      .flat(),
  );
}

/**
 * What a sheet says it is, from the lines above its first section
 * ("FIAT CRONOS DRIVE 1.3 MT – Ficha técnica", "FIAT MOBI DRIVE" + "1.0 FLEX"):
 * the press room's link titles are sometimes of another sheet of the page.
 */
export function sheetHeading(lines: string[]): string | undefined {
  const top: string[] = [];
  for (const line of lines.slice(0, 4)) {
    if (/^motor\b|:/i.test(line.trim())) break;
    top.push(line);
  }
  const heading = top
    .join(" ")
    // Pieces of split words too: "Ficha T écnica".
    .replace(/ficha\s*t\s*[eé]\s*cnica|engenharia do produto.*$|atualizado em.*$|as informa[cç][oõ]es contidas.*$|automóveis ltda/gi, " ")
    .replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3")
    .replace(/^\s*[–—-]\s*|[–—-]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return heading.length >= 4 ? heading : undefined;
}

/**
 * The link a downloaded PDF came from, by its file name: the press room names
 * it after the sheet's title, sometimes with the model year ("…automaticomy23-
 * 6438084e4ee4c.pdf"), and ends it with PHP's uniqid, the upload time in hex.
 * Without a year in the name, the model year nearest after the upload wins.
 */
export function linkOfFile(file: string, links: SheetLink[]): SheetLink | undefined {
  // Downloaded from the checklist in order: "053-…" is its 53rd link.
  const position = file.match(/^(\d{1,4})-/)?.[1];
  if (position) return checklistOrder(links)[Number(position) - 1];
  const name = slug(file.replace(/\.pdf$/i, ""));
  const year = name.match(/my(\d{2})(?:[0-9a-f]{13})?$/)?.[1];
  const uploaded = file.match(/-([0-9a-f]{8})[0-9a-f]{5}\.pdf$/i)?.[1];
  const uploadYear = uploaded ? new Date(parseInt(uploaded, 16) * 1000).getFullYear() : undefined;
  const matching = links
    .filter((link) => link.title && name.includes(slug(link.title)))
    // The longest title that fits: "Pulse Audace Turbo 200…" over "Pulse Turbo 200…".
    .sort((a, b) => slug(b.title).length - slug(a.title).length);
  const best = matching.filter((link) => slug(link.title).length === slug(matching[0]?.title ?? "").length);
  if (year) return best.find((link) => link.modelYear === 2000 + Number(year)) ?? best[0];
  if (uploadYear !== undefined) {
    const after = best
      .filter((link) => link.modelYear !== null && link.modelYear >= uploadYear)
      .sort((a, b) => a.modelYear! - b.modelYear!);
    return after[0] ?? best.sort((a, b) => (b.modelYear ?? 0) - (a.modelYear ?? 0))[0];
  }
  return best[0];
}

/** FIPE brands of each press room. */
const fipeBrands: Record<string, string[]> = {
  fiat: ["Fiat"], abarth: ["Fiat"], jeep: ["Jeep"], ram: ["RAM"], peugeot: ["Peugeot"],
  citroen: ["Citroën"], leapmotor: ["Leapmotor"], chrysler: ["Chrysler"], dodge: ["Dodge"],
};
// "1.3" stays one word; "Aut." loses its dot.
const words = (text: string) =>
  plain(text)
    .split(/[^a-z0-9.]+/)
    .map((word) => word.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
// Words of a FIPE name that say nothing about the trim.
const notATrim =
  /^(\d.*|flex|gasolina|diesel|eletrico|hibrido|turbo|turbodiesel|automatico|automatica|aut|manual|mec|cvt|at\d*|mt\d*|tb|4x2|4x4|cabine|dupla|simples|estendida|cd|cs|ce|de|e|com|v\d+|mpi|mhev|hybrid|my\d*)$/;

/** The cab of a pickup: "cd" (double), "cs" (single), "ce" (extended), or none. */
function cabOf(text: string): string | undefined {
  const words = ` ${plain(text).replace(/[^a-z0-9]+/g, " ")} `;
  if (/ cabine dupla | cd /.test(words)) return "cd";
  if (/ cabine simples | cs /.test(words)) return "cs";
  if (/ cabine estendida | ce /.test(words)) return "ce";
  return undefined;
}
const brandWords = /^(fiat|jeep|ram|peugeot|citroen|abarth|leapmotor|chrysler|dodge|novo|nova|new|my|\d{2,4})$/;

/**
 * The words of a sheet's title, as one string with no spaces: the press room
 * writes some as file names ("fichatecnicapulsedrive13flexmanualmy27-6a84abde9579c"),
 * so lookups go by substring. "Ficha técnica", the model year and the upload id
 * are left out.
 */
export function titleSlug(title: string): string {
  return plain(title)
    .replace(/-[0-9a-f]{13}$/, "")
    .replace(/ficha\s*_?\s*tecnica|\bft_/g, " ")
    .replace(/\bmy\s*\d{2,4}\b|my\d{2,4}$/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

/** The model year a sheet is for: its page's, else its title's ("MY26", "2026_2027" → 2027). */
export function sheetYear(sheet: Pick<ReadSheet, "modelYear" | "title">): number | null {
  if (sheet.modelYear) return sheet.modelYear;
  // PDFs split words into pieces: "202 6 /2026", "MY2 6".
  const title = sheet.title.replace(/(\d)\s+(?=\d)/g, "$1").replace(/\s*([_/-])\s*/g, "$1");
  const span = title.match(/\b(20\d\d)[_/-](20\d\d)\b/);
  if (span) return Number(span[2]);
  const my = plain(title).match(/my\s*(\d{4}|\d{2})(?!\d)/)?.[1];
  return my ? (my.length === 2 ? 2000 + Number(my) : Number(my)) : null;
}

/** The line a sheet is for, from its page ("Fiat Pulse MY27" → "pulse", "Jeep® Compass MY 2022" → "compass"). */
export function sheetLine(pageTitle: string): string {
  return words(pageTitle).filter((word) => !brandWords.test(word))[0] ?? "";
}

/** What a version needs to get a sheet. */
export interface SheetTarget {
  brand: string;
  family: string;
  name: string;
  modelYear: number;
  engineLiters?: number;
  turbo: boolean;
}

const automaticIn = (text: string) => /automatic|\baut\b|cvt|at\d|\bat\b/.test(text);
const manualIn = (text: string) => /manual|\bmec\b|mt\d/.test(text);

/**
 * The sheet of a version-year: same brand, line (from the sheet's page) and
 * model year; the trims of the line that the sheet's title names are exactly
 * the version's ("Audace" in "PULSE AUDACE 1.0 Turbo 200 Flex Aut."); no clash
 * in engine (turbo, 1.3) or transmission. lineTrims are the trim words of the
 * line's FIPE names (trimsOf).
 */
export function sheetOfVersion<T extends Pick<ReadSheet, "brand" | "title" | "modelYear" | "pageTitle">>(
  sheets: T[],
  target: SheetTarget,
  lineTrims: Set<string>,
): T | undefined {
  const nameWords = words(target.name);
  const family = words(target.family)[0] ?? "";
  const versionTrims = new Set(nameWords.filter((word) => lineTrims.has(word)));
  const versionAutomatic = automaticIn(nameWords.join(" "));
  let best: { sheet: T; score: number } | undefined;
  for (const sheet of sheets) {
    if (!fipeBrands[sheet.brand]?.includes(target.brand)) continue;
    if (sheetYear(sheet) !== target.modelYear || sheetLine(sheet.pageTitle) !== family) continue;
    // The line's trims the title names, longest first so "sdesign" is not read as "design" too.
    // Two-letter trims ("Live Go", "GT") only as whole words, not inside glued text ("veRSões").
    let left = titleSlug(sheet.title).replace(family, " ");
    const titleWords = ` ${words(sheet.title).join(" ")} `;
    const named = new Set<string>();
    for (const trim of [...lineTrims].sort((a, b) => b.length - a.length)) {
      if (trim.length === 2 ? titleWords.includes(` ${trim} `) : left.includes(trim)) {
        named.add(trim);
        left = left.replace(trim, " ");
      }
    }
    if (named.size !== versionTrims.size || [...named].some((trim) => !versionTrims.has(trim))) continue;
    const readable = plain(sheet.title);
    const title = titleSlug(sheet.title);
    // Diesel engines are all turbocharged, as FIPE writes them ("TB Diesel").
    const turbo = /turbo|t200|t270|t180|tdi|td\d|diesel|multijet/.test(title) || /\btb\b/.test(readable);
    // A sheet that names a turbo is not of an aspirated version; one that does not may still be
    // ("Fastback Abarth Flex 1.3 AT6" is the 1.3 turbo).
    if (turbo && !target.turbo) continue;
    const liters = readable.match(/(\d)[.,](\d)/);
    const sheetLiters = liters ? Number(liters[1] + "." + liters[2]) : undefined;
    if (sheetLiters !== undefined && target.engineLiters !== undefined && Math.abs(sheetLiters - target.engineLiters) > 0.05) continue;
    const sheetCab = cabOf(sheet.title);
    const versionCab = cabOf(target.name);
    if (sheetCab && versionCab && sheetCab !== versionCab) continue;
    const sheetAutomatic = automaticIn(title) || automaticIn(readable);
    const sheetManual = manualIn(title) || manualIn(readable);
    if ((sheetAutomatic && !versionAutomatic) || (sheetManual && versionAutomatic)) continue;
    const score = named.size * 2 + (sheetAutomatic || sheetManual ? 1 : 0) + (sheetLiters ? 1 : 0);
    if (!best || score > best.score) best = { sheet, score };
  }
  return best?.sheet;
}

/** The trim words of a line's FIPE names ("drive", "audace", "impetus", "abarth"). */
export function trimsOf(names: string[], family: string): Set<string> {
  const familyWords = new Set(words(family));
  return new Set(
    names.flatMap((name) => words(name).filter((word) => !familyWords.has(word) && !notATrim.test(word) && word.length >= 2)),
  );
}


const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** "4.095" → 4095, "3998,0" → 3998, "20,4" → 20.4. */
const number = (text: string) => Number(text.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
const numbersBefore = (text: string, unit: string) =>
  [...text.matchAll(new RegExp(`(?<![\\d.,])(\\d+(?:\\.\\d{3})*(?:,\\d+)?)\\s*${unit}`, "gi"))].map((match) =>
    number(match[1]!),
  );

// Labels of the figures the app uses, for sheets laid out as tables
// ("Potência máxima | ABNT | 77,0 cv", "RESERVATÓRIOS | Tanque de combustível | 48,0 L").
const tableLabels =
  /(potencia maxima|torque maximo|em ordem de marcha|comprimento|largura|altura minima do solo|altura|distancia entre eixos|entre-eixos|vao livre|porta-malas|compartim\w*\.? de bagagem|tanque de combustivel|velocidade maxima|0 a 100)/;

/**
 * A sheet's fields, from its text lines in reading order: "Campo: valor"
 * lines, and in tables a line with a known label anywhere in it. A line
 * without either continues the field above it ("…/ 200" + "Nm / 20,4 kgfm
 * (etanol) a 1.700 rpm"); words split around a hyphen are joined back
 * ("porta - malas").
 */
export function sheetFields(lines: string[]): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  for (const raw of lines) {
    const line = raw.replace(/(\p{L})\s+-\s+(\p{L})/gu, "$1-$2").replace(/\s+/g, " ").trim();
    const colon = line.indexOf(":");
    const table = plain(line).match(tableLabels);
    if (colon > 0 && colon < 70) {
      fields.push({ label: plain(line.slice(0, colon)).trim(), value: line.slice(colon + 1).trim() });
    } else if (table) {
      fields.push({ label: table[1]!, value: plain(line).slice(table.index! + table[1]!.length).trim() });
    } else if (fields.length) {
      fields.at(-1)!.value += ` ${line}`;
    }
  }
  return fields;
}

// What a car's figures can be, to tell them from a table's other numbers.
const ranges: Record<keyof SheetSpecs, [number, number]> = {
  powerCv: [40, 900],
  torqueKgfm: [5, 160],
  weightKg: [600, 4500],
  lengthMm: [2500, 7500],
  widthMm: [1400, 2600],
  heightMm: [1100, 3200],
  wheelbaseMm: [1800, 4600],
  groundClearanceMm: [90, 400],
  trunkLiters: [100, 2000],
  tankLiters: [25, 200],
  topSpeedKmh: [90, 350],
  zeroTo100s: [2.5, 30],
};

/** The figures the app uses, read from a sheet's fields. */
export function sheetSpecs(lines: string[]): SheetSpecs {
  const fields = sheetFields(lines);
  // Every field with that label: a word may show up elsewhere ("regulagem de altura"),
  // and tables give gasoline and ethanol on lines of their own.
  const all = (pattern: RegExp) => fields.filter((field) => pattern.test(field.label)).map((field) => field.value);
  const specs: SheetSpecs = {};
  const set = (key: keyof SheetSpecs, value: number | undefined) => {
    if (value !== undefined && Number.isFinite(value) && value > 0) specs[key] = value;
  };
  // Only figures a car can have: a table's label may sit next to another number.
  const plausible = (key: keyof SheetSpecs) => (value: number) => value >= ranges[key][0] && value <= ranges[key][1];
  const first = (key: keyof SheetSpecs, pattern: RegExp, unit: string) =>
    all(pattern)
      .flatMap((value) => numbersBefore(value, unit))
      .find(plausible(key));
  const highest = (key: keyof SheetSpecs, pattern: RegExp, unit: string) => {
    const found = all(pattern)
      .flatMap((value) => numbersBefore(value, unit))
      .filter(plausible(key));
    return found.length ? Math.max(...found) : undefined;
  };

  set("powerCv", highest("powerCv", /^potencia( maxima|$)/, "cv"));
  const torque = /^torque( maximo|$)/;
  const newtonMeters = all(torque)
    .flatMap((value) => numbersBefore(value, "Nm"))
    .map((value) => Math.round((value / 9.80665) * 10) / 10)
    .filter(plausible("torqueKgfm"));
  set("torqueKgfm", highest("torqueKgfm", torque, "kgf\\.?\\s?m") ?? (newtonMeters.length ? Math.max(...newtonMeters) : undefined));
  set("weightKg", first("weightKg", /ordem de marcha|^peso/, "kg"));
  set("lengthMm", first("lengthMm", /^comprimento/, "mm"));
  set("widthMm", first("widthMm", /^largura(?! (na|entre))/, "mm"));
  set("heightMm", first("heightMm", /^altura( do veiculo|$)/, "mm"));
  set("wheelbaseMm", first("wheelbaseMm", /entre-?\s?eixos/, "mm"));
  set("groundClearanceMm", first("groundClearanceMm", /altura minima do solo|vao livre/, "mm"));
  set("trunkLiters", first("trunkLiters", /porta-?\s?malas|de bagagem/, "(?:litros|l\\b)"));
  set("tankLiters", first("tankLiters", /^tanque/, "(?:litros|l\\b)"));
  // Not the top speed in each gear.
  const speeds = all(/^velocidade maxima/)
    .filter((value) => !/marcha/.test(plain(value)))
    .flatMap((value) => numbersBefore(value, "km\\/h"))
    .filter(plausible("topSpeedKmh"));
  if (speeds.length) set("topSpeedKmh", Math.max(...speeds));
  const seconds = all(/^0 a 100/)
    .flatMap((value) => numbersBefore(value, "s\\b"))
    .filter(plausible("zeroTo100s"));
  if (seconds.length) set("zeroTo100s", Math.min(...seconds));
  return specs;
}
