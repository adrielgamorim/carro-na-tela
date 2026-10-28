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
 * The link a downloaded PDF came from, by its file name: the press room names
 * it after the sheet's title, sometimes with the model year ("…automaticomy23-
 * 6438084e4ee4c.pdf"), and ends it with PHP's uniqid, the upload time in hex.
 * Without a year in the name, the model year nearest after the upload wins.
 */
export function linkOfFile(file: string, links: SheetLink[]): SheetLink | undefined {
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
  /^(\d.*|flex|gasolina|diesel|eletrico|hibrido|turbo|turbodiesel|automatico|automatica|aut|manual|mec|cvt|at\d*|mt\d*|tb|4x2|4x4|cabine|dupla|simples|cd|cs|ce|de|e|com|v\d+|mpi|mhev|hybrid|plus|my\d*)$/;
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
  const span = sheet.title.match(/\b(20\d\d)[_/-](20\d\d)\b/);
  if (span) return Number(span[2]);
  const my = plain(sheet.title).match(/my\s*(\d{4}|\d{2})(?!\d)/)?.[1];
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
    let left = titleSlug(sheet.title).replace(family, " ");
    const named = new Set<string>();
    for (const trim of [...lineTrims].sort((a, b) => b.length - a.length)) {
      if (left.includes(trim)) {
        named.add(trim);
        left = left.replace(trim, " ");
      }
    }
    if (named.size !== versionTrims.size || [...named].some((trim) => !versionTrims.has(trim))) continue;
    const readable = plain(sheet.title);
    const title = titleSlug(sheet.title);
    const turbo = /turbo|t200|t270|t180|tdi|td\d/.test(title) || /\btb\b/.test(readable);
    if (turbo !== target.turbo && (turbo || /\d[.,]\d/.test(readable))) continue;
    const liters = readable.match(/(\d)[.,](\d)/);
    const sheetLiters = liters ? Number(liters[1] + "." + liters[2]) : undefined;
    if (sheetLiters !== undefined && target.engineLiters !== undefined && Math.abs(sheetLiters - target.engineLiters) > 0.05) continue;
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
    names.flatMap((name) => words(name).filter((word) => !familyWords.has(word) && !notATrim.test(word) && word.length >= 3)),
  );
}


const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** "4.095" → 4095, "20,4" → 20.4. */
const number = (text: string) => Number(text.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
const numbersBefore = (text: string, unit: string) =>
  [...text.matchAll(new RegExp(`(\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?)\\s*${unit}`, "gi"))].map((match) => number(match[1]!));

/**
 * A sheet's "Campo: valor" fields, from its text lines in reading order. A
 * line without a colon continues the field above it ("…/ 200" + "Nm / 20,4
 * kgfm (etanol) a 1.700 rpm"); words split around a hyphen are joined back
 * ("porta - malas").
 */
export function sheetFields(lines: string[]): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  for (const raw of lines) {
    const line = raw.replace(/(\p{L})\s+-\s+(\p{L})/gu, "$1-$2").replace(/\s+/g, " ").trim();
    const colon = line.indexOf(":");
    if (colon > 0 && colon < 70) {
      fields.push({ label: plain(line.slice(0, colon)).trim(), value: line.slice(colon + 1).trim() });
    } else if (fields.length) {
      fields.at(-1)!.value += ` ${line}`;
    }
  }
  return fields;
}

/** The figures the app uses, read from a sheet's fields. */
export function sheetSpecs(lines: string[]): SheetSpecs {
  const fields = sheetFields(lines);
  const find = (pattern: RegExp) => fields.find((field) => pattern.test(field.label))?.value;
  const specs: SheetSpecs = {};
  const set = (key: keyof SheetSpecs, value: number | undefined) => {
    if (value !== undefined && Number.isFinite(value) && value > 0) specs[key] = value;
  };
  const first = (text: string | undefined, unit: string) => (text ? numbersBefore(text, unit)[0] : undefined);
  const highest = (text: string | undefined, unit: string) =>
    text && numbersBefore(text, unit).length ? Math.max(...numbersBefore(text, unit)) : undefined;

  set("powerCv", highest(find(/^potencia maxima/), "cv"));
  const torque = find(/^torque maximo/);
  set("torqueKgfm", highest(torque, "kgf\\.?\\s?m") ?? (torque && numbersBefore(torque, "Nm").length
    ? Math.round((Math.max(...numbersBefore(torque, "Nm")) / 9.80665) * 10) / 10
    : undefined));
  set("weightKg", first(find(/ordem de marcha|^peso/), "kg"));
  set("lengthMm", first(find(/^comprimento/), "mm"));
  set("widthMm", first(find(/^largura/), "mm"));
  set("heightMm", first(find(/^altura do veiculo|^altura$/), "mm"));
  set("wheelbaseMm", first(find(/entre-?\s?eixos/), "mm"));
  set("groundClearanceMm", first(find(/altura minima do solo|vao livre/), "mm"));
  set("trunkLiters", first(find(/porta-?\s?malas/), "(?:litros|l\\b)"));
  set("tankLiters", first(find(/^tanque/), "(?:litros|l\\b)"));
  set("topSpeedKmh", highest(find(/^velocidade maxima/), "km\\/h"));
  const sprint = fields.find((field) => /^0 a 100/.test(field.label))?.value;
  if (sprint) {
    const seconds = numbersBefore(sprint, "s\\b");
    if (seconds.length) set("zeroTo100s", Math.min(...seconds));
  }
  return specs;
}
