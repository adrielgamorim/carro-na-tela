// Press photos the brands allowed us to show, from data/imprensa/fotos:
// a folder per brand ("Renault"), with its autorizacao.json (the credit and
// the press room), and the photos in a folder per line and model year
// ("Duster 2025", "Kwid 2023-2025") or named so ("duster-2025-frente.jpg").
// The angle comes from the name ("frente", "traseira", "lateral",
// "interior"…). Pure functions; npm run fotos:imprensa runs them.

import type { Angle } from "../wikidata/gallery.ts";

export interface PressAuthorization {
  /** Shown under the photo: "Renault do Brasil / Divulgação". */
  credito: string;
  /** The press room, the photo's link. */
  link: string;
  /** When the brand allowed it (YYYY-MM-DD). */
  autorizadoEm?: string;
  /** Who allowed it, for our records. */
  contato?: string;
  /** What the permission says ("sem edição", "com crédito"…). */
  condicoes?: string;
}

const plain = (text: string) =>
  text
    // "FiatStrada", "ArgoX": words written together; "Ford%20Ranger" saved as "Ford-20Ranger".
    .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
    .replace(/(^|[-_ ])20(?=\p{L})/gu, "$1 ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The model years a name gives: "Duster 2025" → 2025–2025; "Kwid 2023-2025" → 2023–2025;
 * "cronos-drive-my26" → 2026. Four-digit years only, not inside longer numbers (timestamps)
 * nor an image's size ("2048x1152").
 */
export function pressYears(name: string): [number, number] | undefined {
  const years = [
    ...[...name.matchAll(/(?<![\dx])(199\d|20[0-4]\d)(?![\dx])/gi)].map((match) => Number(match[1])),
    ...[...name.matchAll(/\bmy[ _-]?(\d\d)(?!\d)/gi)].map((match) => 2000 + Number(match[1])),
  ];
  if (!years.length) return undefined;
  return [Math.min(...years), Math.max(...years)];
}

/** Photos that are not of a car on sale: racing, concepts on show, logos, events, awards ("Titano Premio Lotus 2025"). */
export function notACarOnSale(name: string): boolean {
  return /\b(formula ?1|f1|9x8|hypercar|le mans|rally|racing|corrida|stock car|logo|logotipo|millionth|evento|event|fabrica|factory|planta|concept|conceito|premio|premios|premiacao|award|trofeu)\b/.test(
    plain(name),
  );
}

/** The angle a photo's name says: "frente"/"front", "traseira"/"rear", "lateral"/"side", "interior"/"painel". */
export function pressAngle(name: string): Angle {
  const words = plain(name);
  if (/\b(interior|interna|interno|painel|cabine|cockpit|dashboard|bancos?|volante|console)\b/.test(words)) return "interior";
  if (/\b(traseira|traseiro|rear|back|tras)\b/.test(words)) return "traseira";
  if (/\b(lateral|side|perfil|profile)\b/.test(words)) return "lateral";
  if (/\b(frente|frontal|dianteira|front|3 ?4)\b/.test(words)) return "frente";
  return "outra";
}

export interface PressModel {
  id: string;
  label: string;
  /** The lines FIPE names its versions by ("2500" for "Ram pickup"). */
  families?: string[];
}

/** A model label's words after the first (the brand's), without "(2021)" or "(DT)". */
const tailOf = (label: string) => plain(label.replace(/\s*\([^)]*\)/g, "")).split(" ").slice(1);

// Words that name a model only with others: "Pulse Impetus Turbo 200" is not the Uno Turbo,
// "Corolla … ampliacao previa" not the Toyota Previa.
const ordinary = /^(turbo|sport|cross|cargo|plus|max|top|city|work|van|life|previa|premio|classic|special)$/;

// "500.000 Toro em Goiana": a thousand is one number, not the Fiat 500.
const wordsOf = (name: string) => new Set(plain(name.replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2")).split(" "));

/** The model whose label's words (after the brand's) all appear, the longest such ("Duster Oroch" over "Duster"). */
function byLabel(words: Set<string>, models: PressModel[]): PressModel | undefined {
  let best: { model: PressModel; size: number } | undefined;
  for (const model of models) {
    const tail = tailOf(model.label);
    if (!tail.length || (tail.length === 1 && ordinary.test(tail[0]!))) continue;
    if (!tail.every((word) => words.has(word))) continue;
    if (!best || tail.length > best.size) best = { model, size: tail.length };
  }
  return best?.model;
}

/** "Ram 2500 Laramie": FIPE's line, for a model whose label does not say it ("Ram pickup"). */
function byFamily(words: Set<string>, models: PressModel[]): PressModel | undefined {
  const named = models.filter((model) => model.families?.some((family) => plain(family).split(" ").every((word) => words.has(word))));
  return named.length === 1 ? named[0] : undefined;
}

/** "Aircross", "SW4": the label's last word alone, when only one model has it. */
function byLast(words: Set<string>, models: PressModel[]): PressModel | undefined {
  const found = models.filter((model) => {
    const last = tailOf(model.label).at(-1) ?? "";
    return last.length >= 3 && !/^\d+$/.test(last) && !ordinary.test(last) && words.has(last);
  });
  return found.length === 1 ? found[0] : undefined;
}

/**
 * The model a folder or file names, of the brand's: by its label's words, by FIPE's
 * line, then by the label's last word alone. In a downloaded file
 * ("00150-Jeep-Commander-Renegade_700mil-0539ebec7253.jpg": number, brand, the
 * line it was filed under, the original name, a hash) the original name comes
 * first at each step: the line it was filed under is sometimes another.
 */
export function pressModel(name: string, models: PressModel[]): PressModel | undefined {
  const parts = name.split("/").pop()!.split("-");
  const downloaded = parts.length > 4 && /^\d{4,}$/.test(parts[0]!);
  const names = [...(downloaded ? [parts.slice(3, -1).join(" ")] : []), name].map(wordsOf);
  for (const find of [byLabel, byFamily, byLast]) {
    for (const words of names) {
      const model = find(words, models);
      if (model) return model;
    }
  }
  return undefined;
}

/** "Renault" names "Renault"; "Volkswagen" names "VW - VolksWagen"; "Chevrolet" names "GM - Chevrolet". */
export function namesBrand(folder: string, brand: string): boolean {
  const joined = (text: string) => plain(text).replace(/ /g, "");
  const wanted = joined(folder);
  return joined(brand) === wanted || joined(brand.split(" - ").at(-1) ?? "") === wanted;
}

/** "Duster 2025/IMG 001 Frente.JPG" → "duster-2025-img-001-frente.webp". */
export function pressFileName(path: string): string {
  return `${plain(path.replace(/\.[a-z0-9]+$/i, "")).replace(/ /g, "-")}.webp`;
}
