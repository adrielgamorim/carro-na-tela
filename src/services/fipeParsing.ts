// Pure FIPE value parsers, free of browser/Vite dependencies so Node scripts
// can import them too.

export interface FipeYearCode {
  modelYear: number;
  fuelCode: string;
}

/** FIPE's model year for brand-new (0 km) vehicles. */
export const zeroKmModelYear = 32000;

export function formatModelYear(modelYear: number): string {
  return modelYear === zeroKmModelYear ? "0 km" : String(modelYear);
}

export function parseFipeYearCode(code: string): FipeYearCode | null {
  const match = /^(\d{4,5})-(\d+)$/.exec(code);
  if (!match) return null;

  return { modelYear: Number(match[1]), fuelCode: match[2] ?? "" };
}

export function parseFipePrice(price: string): number {
  const normalized = price
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number(normalized);

  return Number.isFinite(value) ? value : 0;
}

// First words that only name a line together with the next word
// (e.g. "Grand Siena", "Range Rover", "Classe C", "Série 3").
const twoWordFamilyPrefixes = new Set([
  "classe",
  "gran",
  "grand",
  "land",
  "new",
  "range",
  "santa",
  "serie",
  "série",
  "space",
  "town",
]);

export function getModelFamily(modelName: string): string {
  const words = modelName.trim().split(/\s+/);
  const first = words[0] ?? "";

  if (words.length > 1 && twoWordFamilyPrefixes.has(first.toLocaleLowerCase("pt-BR"))) {
    return `${first} ${words[1]}`;
  }
  return first;
}
