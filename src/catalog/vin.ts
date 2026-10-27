// Chassis number (VIN, ISO 3779) decoding that needs no network: format,
// manufacturer (WMI, first three characters), country, model year (10th
// character) and the North American check digit. The WMI table comes from
// public/catalog/wmi.json (npm run fetch:wmi).

/** One manufacturer a WMI is assigned to. */
export interface WmiMaker {
  /** Description from the source list, e.g. "Volkswagen do Brasil". */
  m: string;
  /** Country, when the list gives one. */
  c?: string;
  /** FIPE brands the maker's name matches (usually one). */
  b?: string[];
}

/** public/catalog/wmi.json */
export interface WmiFile {
  version: 1;
  generatedAt: string;
  source: string;
  /** Country of the first two characters: [from, to, country], ISO ranges. */
  countries: [string, string, string][];
  /** WMI (3 characters, or 2 for a whole range) → manufacturers. */
  wmi: Record<string, WmiMaker[]>;
}

export interface VinInfo {
  vin: string;
  wmi: string;
  country: string | null;
  makers: WmiMaker[];
  /** FIPE brands of every maker, without repeats. */
  brands: string[];
  /** Model year from the 10th character (the most recent one that fits). */
  modelYear: number | null;
  /** Mandatory only in North America; Brazilian chassis rarely satisfy it. */
  checkDigitValid: boolean;
}

/** Order of the second character within a country range (ISO 3780). */
const rangeOrder = "ABCDEFGHJKLMNPRSTUVWXYZ1234567890";
const yearCodes = "ABCDEFGHJKLMNPRSTVWXY123456789";
const transliteration: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** Upper case, without spaces, dots or dashes. */
export function normalizeVin(text: string): string {
  return text.toUpperCase().replace(/[\s.\-–/]/g, "");
}

/** Why the text is not a VIN, in Portuguese, or null when it is one. */
export function vinProblem(vin: string): string | null {
  if (!vin) return "Digite o chassi.";
  const invalid = [...new Set(vin.replace(/[A-HJ-NPR-Z0-9]/g, ""))];
  if (invalid.length) {
    const letters = invalid.join(", ");
    return /^[IOQ, ]+$/.test(letters)
      ? `O chassi não usa as letras I, O e Q (confira se não são 1 ou 0): ${letters}.`
      : `Caracteres inválidos: ${letters}.`;
  }
  if (vin.length !== 17) return `O chassi tem 17 caracteres; este tem ${vin.length}.`;
  return null;
}

export function vinCheckDigitValid(vin: string): boolean {
  let sum = 0;
  for (let index = 0; index < 17; index++) {
    const char = vin[index];
    const value = /\d/.test(char) ? Number(char) : transliteration[char];
    if (value === undefined) return false;
    sum += value * weights[index];
  }
  const expected = sum % 11 === 10 ? "X" : String(sum % 11);
  return vin[8] === expected;
}

/**
 * Model year from the 10th character. The code repeats every 30 years; North
 * American VINs tell the cycle by the 7th character (a letter from 2010 on),
 * elsewhere the most recent year up to next year is taken.
 */
export function vinModelYear(vin: string, now = new Date()): number | null {
  const index = yearCodes.indexOf(vin[9]);
  if (index < 0) return null;
  if (/[1-5]/.test(vin[0])) return 1980 + index + (/\d/.test(vin[6]) ? 0 : 30);
  const latest = now.getFullYear() + 1;
  let year = 1980 + index;
  while (year + 30 <= latest) year += 30;
  return year;
}

function inRange(code: string, from: string, to: string): boolean {
  if (code[0] !== from[0]) return false;
  const position = rangeOrder.indexOf(code[1]);
  return position >= rangeOrder.indexOf(from[1]) && position <= rangeOrder.indexOf(to[1]);
}

export function decodeVin(file: WmiFile, vin: string, now = new Date()): VinInfo {
  const wmi = vin.slice(0, 3);
  const makers = file.wmi[wmi] ?? file.wmi[wmi.slice(0, 2)] ?? [];
  const country =
    makers.find((maker) => maker.c)?.c ??
    file.countries.find(([from, to]) => inRange(vin, from, to))?.[2] ??
    null;
  return {
    vin,
    wmi,
    country,
    makers,
    brands: [...new Set(makers.flatMap((maker) => maker.b ?? []))],
    modelYear: vinModelYear(vin, now),
    checkDigitValid: vinCheckDigitValid(vin),
  };
}
