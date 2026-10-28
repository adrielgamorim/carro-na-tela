/** [smallest, largest] value across the model's variants; equal when only one. */
export type SpecRange = [number, number];

/**
 * Size (meters), mass (kg) and power (cv) of the model line, from Wikidata
 * and Wikipedia infoboxes: approximate for a given version.
 */
export interface ModelSpecs {
  length?: SpecRange;
  width?: SpecRange;
  height?: SpecRange;
  wheelbase?: SpecRange;
  mass?: SpecRange;
  power?: SpecRange;
}

/**
 * Wikidata / Wikimedia Commons data of a model line ("Chevrolet Onix"),
 * matched to FIPE versions by name. It describes the whole line, so it is
 * always a "fuzzy" match for a given version.
 */
export interface CatalogModelInfo {
  /**
   * Wikidata id ("Q18683502"), or for a line Wikidata has no model for, where
   * the picture came from ("wikipedia:pt:Fiat Punto", "commons:<file>").
   */
  id: string;
  label: string;
  /** Opening of the Portuguese Wikipedia article, else the Wikidata description. */
  description?: string;
  wikipedia?: string;
  specs?: ModelSpecs;
  image?: CatalogPhoto;
  /** Photos in the model's gallery file (src/catalog/gallery.ts), when it has one. */
  gallery?: number;
}

/** A Wikimedia Commons photo with its credits. */
export interface CatalogPhoto {
  /** About 480 px wide. */
  thumb: string;
  /** Commons file page (author and license). */
  page: string;
  artist?: string;
  license?: string;
}

export const wikidataUrl = (id: string) => `https://www.wikidata.org/wiki/${id}`;

/** Whether the info is a Wikidata item (and not a Wikipedia/Commons fallback). */
export const isWikidataItem = (id: string) => /^Q\d+$/.test(id);

const meters = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kilograms = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** "≈ 4,00 m", "≈ 3,95–4,10 m", "≈ 1.150 kg", "≈ 72–139 cv": approximate, from the model line. */
export function formatSpec(key: keyof ModelSpecs, [low, high]: SpecRange): string {
  const whole = key === "mass" || key === "power";
  const format = (value: number) => (whole ? kilograms.format(value) : meters.format(value));
  const unit = key === "mass" ? "kg" : key === "power" ? "cv" : "m";
  return `≈ ${low === high ? format(low) : `${format(low)}–${format(high)}`} ${unit}`;
}

/** Ficha rows of the model's size and mass, in display order. */
export const specLabels: [keyof ModelSpecs, string][] = [
  ["length", "Comprimento"],
  ["width", "Largura"],
  ["height", "Altura"],
  ["wheelbase", "Entre-eixos"],
  ["mass", "Peso"],
];
