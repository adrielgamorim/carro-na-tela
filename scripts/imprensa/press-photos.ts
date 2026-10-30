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
 * "cronos-drive-my26" → 2026. Four-digit years only, not inside longer numbers (timestamps).
 */
export function pressYears(name: string): [number, number] | undefined {
  const years = [
    ...[...name.matchAll(/(?<!\d)(199\d|20[0-4]\d)(?!\d)/g)].map((match) => Number(match[1])),
    ...[...name.matchAll(/\bmy[ _-]?(\d\d)(?!\d)/gi)].map((match) => 2000 + Number(match[1])),
  ];
  if (!years.length) return undefined;
  return [Math.min(...years), Math.max(...years)];
}

/** Photos that are not of a car on sale: racing, concepts on show, logos, events. */
export function notACarOnSale(name: string): boolean {
  return /\b(formula ?1|f1|9x8|hypercar|le mans|rally|racing|corrida|stock car|logo|logotipo|millionth|evento|event|fabrica|factory|planta|concept|conceito)\b/.test(
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
}

/** A model label's words after the first (the brand's), without "(2021)" or "(DT)". */
const tailOf = (label: string) => plain(label.replace(/\s*\([^)]*\)/g, "")).split(" ").slice(1);

function modelIn(name: string, models: PressModel[]): PressModel | undefined {
  const words = new Set(plain(name).split(" "));
  let best: { model: PressModel; size: number } | undefined;
  for (const model of models) {
    const tail = tailOf(model.label);
    if (!tail.length || !tail.every((word) => words.has(word))) continue;
    if (!best || tail.length > best.size) best = { model, size: tail.length };
  }
  if (best) return best.model;
  // "Aircross", "SW4": the label's last word alone, when only one model has it.
  const byLast = models.filter((model) => {
    const last = tailOf(model.label).at(-1) ?? "";
    return last.length >= 3 && !/^\d+$/.test(last) && words.has(last);
  });
  return byLast.length === 1 ? byLast[0] : undefined;
}

/**
 * The model a folder or file names, of the brand's: the one whose words after
 * the first (the brand's, or Dacia's for some Renault lines) all appear in the
 * name, the longest such ("Duster Oroch" over "Duster"). In a downloaded file
 * ("00150-Jeep-Commander-Renegade_700mil-0539ebec7253.jpg": number, brand, the
 * line it was filed under, the original name, a hash) the original name's
 * model comes first: the line it was filed under is sometimes another.
 */
export function pressModel(name: string, models: PressModel[]): PressModel | undefined {
  const parts = name.split("/").pop()!.split("-");
  const downloaded = parts.length > 4 && /^\d{4,}$/.test(parts[0]!);
  const original = downloaded ? parts.slice(3, -1).join(" ") : "";
  return (original && modelIn(original, models)) || modelIn(name, models);
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
