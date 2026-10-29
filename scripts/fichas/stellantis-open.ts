// Stellantis' sheets as the open press rooms' (open-sheets.ts), for the
// versions their exact match (sheets.ts: same model year, same trims) leaves
// out: a sheet of a span of years ("Rampage 2023 a 2025"), a trim FIPE
// abbreviates ("Endurance" as "Endur."), a van FIPE names otherwise. Matched
// then by line, years, engine, gearbox and cab, the trims only preferred.

import { cabIn, litersOf, plain, transmissionIn, turboIn, words } from "./open-sheets.ts";
import type { OpenSheet } from "./open-sheets.ts";
import { fipeBrands, sheetYear } from "./sheets.ts";
import type { ReadSheet } from "./sheets.ts";

// Words of a page's title that are not its line: brands, "MY 2022", "Novo".
const notTheLine = /^(fiat|jeep|ram|peugeot|citroen|abarth|leapmotor|chrysler|dodge|novo|nova|new|my\d*|\d{4}|a|e|®)$/;
// Words of a sheet's title that are not a trim.
const notATrim =
  /^(\d.*|my\d*|flex|gasolina|diesel|turbodiesel|turbo|tb|td\d*|t\d{3}|at\d*|mt\d*|cvt|aut|manual|automatico|automatica|4x2|4x4|fwd|awd|cd|cs|ce|cabine|dupla|simples|ficha|tecnica|novo|nova|de|e|com|gme|mhev|hybrid|fiat|jeep|ram|peugeot|citroen|abarth|chrysler|automoveis|ltda|fca|latam|rev|pick|up)$/;

const bodies = /^(cargo|maxicargo|minibus|chassi|furgao|vitre|passageiros?|executivo|executive|glazed|van|multi|escolar|ambulancia)$/;
// Vans come in many bodies and lengths, which their sheets name ("Cargo L1H1", "Minibus Luxo").
const vans = /^(ducato|jumper|boxer|expert|scudo|jumpy|e)$/;

/** The years a sheet is for: its model year, a span in its page's title ("2023 a 2025"), or the year it names. */
export function stellantisYears(sheet: Pick<ReadSheet, "modelYear" | "title" | "pageTitle">): [number, number] | undefined {
  const span = sheet.pageTitle.match(/\b(20\d\d)\s*a\s*(20\d\d)\b/);
  if (span) {
    const [from, to] = [Number(span[1]), Number(span[2])].sort((a, b) => a - b) as [number, number];
    return [from, to];
  }
  const year = sheetYear(sheet) ?? Number(sheet.pageTitle.match(/\b(20\d\d)\b/)?.[1] ?? NaN);
  return Number.isFinite(year) ? [year, year] : undefined;
}

export function stellantisAsOpen(sheet: ReadSheet): OpenSheet | undefined {
  const years = stellantisYears(sheet);
  const brands = fipeBrands[sheet.brand];
  if (!years || !brands) return undefined;
  const lineWords = words(sheet.pageTitle).filter((word) => !notTheLine.test(word));
  if (!lineWords.length) return undefined;
  const line = lineWords.join(" ");
  // PDFs split numbers into pieces ("20 0 8", "202 6"); not a code's ("AT9 4x4").
  const title = sheet.title.replace(/(?<![a-z\d])(\d+)\s+(?=\d)/gi, "$1");
  const liters = litersOf(title);
  const transmission = transmissionIn(title);
  // Fiat's "Cabine Plus" is the extended cab.
  const cab = cabIn(title.replace(/cabine plus/gi, "CE"));
  const electric = /\bel[eé]tric|\be-\s?\w/i.test(title) && liters === undefined;
  const lineSet = new Set(lineWords);
  const trims = words(title).filter((word) => !notATrim.test(word) && !lineSet.has(word) && word.length >= 2);
  return {
    brand: "stellantis",
    fipeBrands: brands,
    line,
    title: sheet.title,
    trims,
    // A body changes size and weight: a van's (any) or a body's sheet only for versions naming one of its words.
    ...((vans.test(lineWords[0]!) || trims.some((word) => bodies.test(word))) && { onlyNamed: true }),
    years,
    ...(liters !== undefined && { engineLiters: liters }),
    turbo: turboIn(title),
    electric,
    ...(/h[ií]brid|hybrid|mhev|phev/i.test(title) && { hybrid: true }),
    // "TD380", "Turbodiesel", "Multijet"; a flex or gasoline engine is not ("Hurricane", "T270").
    ...(/diesel|\btd ?\d|multijet/i.test(title)
      ? { diesel: true }
      : /flex|gasolina|hurricane|firefly|\bt ?(180|200|270)\b|gse|gme/i.test(title) && { diesel: false }),
    ...(transmission && { transmission }),
    ...(cab && { cab }),
    page: sheet.page,
    url: sheet.url,
    file: sheet.file,
    specs: sheet.specs,
  };
}

/** For the logs: a sheet's line as the open matching reads it. */
export const stellantisLine = (sheet: ReadSheet) => plain(stellantisAsOpen(sheet)?.line ?? "");
