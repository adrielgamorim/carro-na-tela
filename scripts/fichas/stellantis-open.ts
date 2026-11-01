// Stellantis' sheets as the open press rooms' (open-sheets.ts), for the
// versions their exact match (sheets.ts: same model year, same trims) leaves
// out: a sheet of a span of years ("Rampage 2023 a 2025"), a trim FIPE
// abbreviates ("Endurance" as "Endur."), a van FIPE names otherwise. Matched
// then by line, years, engine, gearbox and cab, the trims only preferred.

import { cabIn, litersOf, plain, transmissionIn, turboIn, words } from "./open-sheets.ts";
import type { OpenSheet } from "./open-sheets.ts";
import { fipeBrands, sheetYear } from "./sheets.ts";
import type { ReadSheet } from "./sheets.ts";

// Words of a page's title that are not its line: brands, "MY 2022" (but "Ram 2500" is), "Novo",
// Leapmotor's powertrains ("B10 Ultra-Híbrido (REEV)": FIPE's "B10 (Híbrido)").
const notTheLine =
  /^(fiat|jeep|ram|peugeot|citroen|abarth|leapmotor|chrysler|dodge|novo|nova|new|my\d*|20[1-3]\d|a|e|®|eletrico|bev|reev|ultra|hibrido)$/;
// Words of a sheet's title that are not a trim.
const notATrim =
  /^(\d.*|my\d*|flex|gasolina|diesel|turbodiesel|turbo|tb|td\d*|t\d{3}|at\d*|mt\d*|cvt|aut|manual|automatico|automatica|4x2|4x4|fwd|awd|cd|cs|ce|cabine|dupla|simples|ficha|tecnica|novo|nova|de|e|com|gme|mhev|hybrid|fiat|jeep|ram|peugeot|citroen|abarth|chrysler|leapmotor|automoveis|ltda|fca|latam|rev|pick|up|eletrico|hibrido|ultra|bev|reev)$/;
// Lines whose engines are all turbo, which their titles do not say: "Ram Rampage 2.0 Flex R /T",
// "Ram 2 500 Laramie" (Cummins), "Ram 1500 Big Horn" (the 3.0 twin turbo since 2025).
const allTurbo = /^(rampage|1500|2500|3500)$/;
// Lines all automatic, which FIPE does not say: "3500 LARAMIE 6.7 TB CD 4x4 Diesel".
const allAutomatic = /^(1500|2500|3500)$/;

const bodies = /^(cargo|maxicargo|minibus|chassi|furgao|vitre|passageiros?|executivo|executive|glazed|van|multi|escolar|ambulancia)$/;
// Vans come in many bodies and lengths, which their sheets name ("Cargo L1H1", "Minibus Luxo").
const vans = /^(ducato|jumper|boxer|expert|scudo|jumpy|e)$/;

/** The year a title names: "– 27/27" (made/model), "AT8 202 4" (split by the PDF). */
function titleYear(title: string): number | undefined {
  // Not a code's digits: "AT8 202 4" is AT8 and 2024.
  const joined = title.replace(/(?<![a-z\d])(\d+)\s+(?=\d)/gi, "$1");
  const short = [...joined.matchAll(/(?<![\d/.])(\d\d)\/(\d\d)(?![\d/])/g)].find(
    ([, made, model]) => Number(model) - Number(made) >= 0 && Number(model) - Number(made) <= 1,
  );
  if (short) return 2000 + Number(short[2]);
  const year = joined.match(/(?<!\d)(20[1-3]\d)(?!\d)/)?.[1];
  return year ? Number(year) : undefined;
}

/** When the press room got the PDF: its name ends in PHP's uniqid ("…-688a33534a76c.pdf"), seconds in hex. */
export function uploadYear(file: string): number | undefined {
  const id = file.match(/-([0-9a-f]{13})\.pdf$/i)?.[1];
  if (!id) return undefined;
  const year = new Date(parseInt(id.slice(0, 8), 16) * 1000).getUTCFullYear();
  return year >= 2015 && year <= 2040 ? year : undefined;
}

/**
 * The years a sheet is for: its model year, a span in its page's title ("2023 a 2025"), or the
 * year it names. A page that names none ("Nova Dakota", "Peugeot Expert") is the current model's:
 * the year the PDF came in and the next (the next model year comes out mid-year).
 */
export function stellantisYears(sheet: Pick<ReadSheet, "modelYear" | "title" | "pageTitle" | "file">): [number, number] | undefined {
  // A sheet's own year beats its page's span ("RAM 1500 MY25 LARAMIE" on "Ram 1500 2020 a 2024").
  const own = sheetYear(sheet);
  if (own) return [own, own];
  const span = sheet.pageTitle.match(/\b(20\d\d)\s*a\s*(20\d\d)\b/);
  if (span) {
    const [from, to] = [Number(span[1]), Number(span[2])].sort((a, b) => a - b) as [number, number];
    return [from, to];
  }
  const year = titleYear(sheet.title) ?? titleYear(sheet.pageTitle);
  if (year) return [year, year];
  const uploaded = uploadYear(sheet.file);
  return uploaded ? [uploaded, uploaded + 1] : undefined;
}

export function stellantisAsOpen(sheet: ReadSheet): OpenSheet | undefined {
  const years = stellantisYears(sheet);
  const brands = fipeBrands[sheet.brand];
  if (!years || !brands) return undefined;
  const lineWords = words(sheet.pageTitle).filter((word) => !notTheLine.test(word));
  if (!lineWords.length) return undefined;
  // FIPE's seven-seat Aircross is a line of its own, "AIRCROSS7"; the sheet says "Aircross Feel 7".
  const line = lineWords.join(" ") === "aircross" && /\baircross\b.*\b7\b(?![.,]\d)/i.test(sheet.title) ? "aircross7" : lineWords.join(" ");
  // PDFs split numbers into pieces ("20 0 8", "202 6"); not a code's ("AT9 4x4").
  // And the vans' words: "C argo L 3 H 2", "Turbo d iesel", "Vitr é", "MAXI CARGO" (FIPE's "MaxiCargo").
  // And the letters: "P eugeot 208 A llure T urbo 200", "L IMITED T2 0 0", "GT M HEV", "( RE EV )".
  // Not into an engine size: "RAM 3 500 6,7L" is 3500 and 6,7.
  const title = sheet.title
    .replace(/(?<![a-z\d])(\d+)\s+(?=\d(?!\d*[.,]\d))/gi, "$1")
    .replace(/\b(?:c ?argo|d ?iesel|vitr ?[eé]|executiv ?o|maxi ?cargo|l ?\d ?h ?\d)(?![a-z\d])/gi, (piece) => piece.replace(/\s+/g, ""))
    .replace(/\b([A-Z]) (?=[a-z]{2,})/g, "$1")
    .replace(/\b(?:L IMITED|M HEV|RE EV)\b/g, (piece) => piece.replace(" ", ""))
    .replace(/\bT ?2 ?([07]) ?0\b/g, "T2$10");
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
    // The vans are all turbodiesel (or electric), which their titles do not always say ("FIAT DUCATO MAXI CARGO").
    // The Hurricane is a turbo.
    ...(!vans.test(lineWords[0]!) && !allTurbo.test(lineWords[0]!) && { turbo: turboIn(title) || /hurricane/i.test(title) }),
    electric,
    ...(/h[ií]brid|hybrid|mhev|phev/i.test(title) && { hybrid: true }),
    // "TD380", "Turbodiesel", "Multijet"; a flex or gasoline engine is not ("Hurricane", "T270").
    ...(/diesel|\btd ?\d|multijet/i.test(title)
      ? { diesel: true }
      : /flex|gasolina|hurricane|firefly|\bt ?(180|200|270)\b|gse|gme/i.test(title) && { diesel: false }),
    ...(transmission && !allAutomatic.test(lineWords[0]!) && { transmission }),
    ...(cab && { cab }),
    page: sheet.page,
    url: sheet.url,
    file: sheet.file,
    specs: sheet.specs,
  };
}

/** For the logs: a sheet's line as the open matching reads it. */
export const stellantisLine = (sheet: ReadSheet) => plain(stellantisAsOpen(sheet)?.line ?? "");
