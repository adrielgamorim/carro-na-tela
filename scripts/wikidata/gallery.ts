// Picks a photo gallery per model line from its Wikimedia Commons category
// (npm run fetch:galeria): a few photos per generation, from different
// angles (front, rear, side, interior), by the file names and categories.

import type { ModelGeneration } from "./generations.ts";
import { bodyOf } from "../../src/catalog/gallery.ts";
import type { GalleryBody } from "../../src/catalog/gallery.ts";

export type Angle = "frente" | "traseira" | "lateral" | "interior" | "outra";

/** A Commons file as read from a model's category tree. */
export interface CommonsFile {
  /** File name without "File:". */
  file: string;
  /** About 960 px wide. */
  thumb: string;
  width: number;
  height: number;
  /** Visible categories of the file, without "Category:". */
  categories: string[];
  /** The model's subcategory the file was found in, if not the main one. */
  subcategory?: string;
  artist?: string;
  license?: string;
}

export interface GalleryPhoto {
  file: string;
  thumb: string;
  angle: Angle;
  /** The body style it shows, when it is named ("Logan MCV", "A4 Avant"). */
  body?: GalleryBody;
  /** Model years the photo is shown for (its generation, or around its year). */
  from: number;
  to: number;
  artist?: string;
  license?: string;
}

const lower = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Photos that do not show the car as sold: racing, service liveries, wrecks,
// toys, documents. Categories say so plainly ("Chevrolet Onix taxis").
const notTheCarWords =
  "competition|racing|race cars?|rally|rallye|stock car|nascar|motorsport|taxis?|police|policia|ambulances?|ambulancia|firefighting|bombeiros|accidents?|crash|crashes|wrecks?|wrecked|burned|abandoned|toys?|scale models?|model cars|diecast|die-cast|matchbox|hot wheels|lego|drawings?|sketch|sketches|illustrations?|blueprints?|patents?|logos?|advertisements?|brochures?|posters?|stamps?|tuned|tuning|lowriders?|art cars?|limousines?|mansory|brabus|startech|novitec|hamann|liberty walk|rocket bunny|wald international|prior design";
const notTheCarCategory = new RegExp(`\\b(${notTheCarWords})\\b`);
// File names also name the details: badges, wheels, engines, keys.
const notTheCarFile = new RegExp(`\\b(${notTheCarWords}|emblem|badge|wheels?|rims?|hubcaps?|keys?|engine|motor)\\b`);

/** Whether a subcategory (or a file's category) is about something else than the car itself. */
export function isNotTheCar(category: string): boolean {
  return notTheCarCategory.test(lower(category).replace(/[_()]/g, " "));
}

/** Whether a file name shows something else than the car, or only a detail of it. */
export function isNotTheCarFile(file: string): boolean {
  return notTheCarFile.test(lower(file).replace(/[_()\-.,]/g, " "));
}

const angles: [Angle, RegExp][] = [
  ["interior", /\b(interior|interiors|inside|dashboard|cockpit|cabin|innenraum|armaturenbrett|painel|seats|seat|steering wheel|trunk|boot|porta-malas)\b/],
  ["traseira", /\b(rear|back|heck|traseira|tras|arriere|posteriore|hinten|rr)\b/],
  ["lateral", /\b(side|profile|seitenansicht|lateral|perfil)\b/],
  ["frente", /\b(front|frente|dianteira|avant|anteriore|vorne|fr)\b/],
];

/** Which side of the car a photo shows, by its name and categories. */
export function angleOf(file: string, categories: string[] = []): Angle {
  const name = lower(file).replace(/[_()\-.,]/g, " ");
  for (const [angle, pattern] of angles) if (pattern.test(name)) return angle;
  const categoryText = lower(categories.join(" | ")).replace(/[_()\-.,]/g, " ");
  for (const [angle, pattern] of angles) if (pattern.test(categoryText)) return angle;
  return "outra";
}

// Month names (English, Portuguese, Spanish, German, French) that start a photo's date.
const months =
  "jan|feb|fev|ene|mar|apr|abr|avr|may|mai|mei|jun|jul|aug|ago|aou|sep|set|okt|oct|out|nov|dec|dez|dic";

/**
 * The model year a photo is of, from its name ("2022 Fiat Pulse…", "…Drive
 * 2023.jpg") or a category ("2019 Chevrolet Onix"). Numbers that are part of
 * the model's name ("Peugeot 2008") do not count.
 */
export function photoYear(file: string, categories: string[], modelLabel: string): number | undefined {
  const ownNumbers = new Set(modelLabel.match(/\d{4}/g) ?? []);
  const yearIn = (name: string) => {
    // The date the photo was taken is not the car's year: "03-21-2012", "2024-04-29",
    // "7 June 2026", "(December 2024)", "Oct 2021".
    const text = name
      .replace(/\b\d{1,2}[-./]\d{1,2}[-./](?:19|20)\d\d\b/g, " ")
      .replace(/\b(?:19|20)\d\d[-./]\d{1,2}[-./]\d{1,2}\b/g, " ")
      .replace(new RegExp(`\\b(?:\\d{1,2}\\.?\\s+)?(?:de\\s+)?(?:${months})\\w*\\.?\\s+(?:de\\s+)?(?:19|20)\\d\\d\\b`, "gi"), " ");
    for (const match of text.matchAll(/(?<![\d.,x×])(19[5-9]\d|20[0-3]\d)(?![\d.,x×]|\s*(?:cc|km|mm|kg))/gi)) {
      if (!ownNumbers.has(match[1]!)) return Number(match[1]);
    }
    return undefined;
  };
  return yearIn(file.replace(/\.\w+$/, "")) ?? categories.map(yearIn).find((year) => year !== undefined);
}

const fromBrazil = /\b(brazil|brasil|sao paulo|rio de janeiro|curitiba|belo horizonte|porto alegre|brasilia)\b/;

/** Higher is better: big, landscape, from Brazil, named for its angle. */
function score(photo: CommonsFile, angle: Angle): number {
  const pixels = Math.min(photo.width * photo.height, 12_000_000) / 1_000_000;
  const landscape = photo.width >= photo.height ? 2 : -4;
  const brazil = fromBrazil.test(lower(`${photo.file} ${photo.categories.join(" ")}`)) ? 3 : 0;
  const named = angle === "outra" ? 0 : 2;
  return pixels + landscape + brazil + named;
}

/** Photos kept per generation of the line. */
export const photosPerGeneration = 8;
// The order the gallery shows them, and how many of each angle it wants first.
const wanted: [Angle, number][] = [
  ["frente", 2],
  ["traseira", 1],
  ["lateral", 1],
  ["interior", 2],
  ["outra", 2],
];

const bodyOrView =
  /^(sedans?|saloons?|hatchbacks?|vans?|wagons?|estates?|station wagons?|coupes?|coupés?|convertibles?|cabriolets?|pickups?|pick-ups?|interiors?|rear views?|front views?|side views?)$/;

/**
 * How soon a subcategory is worth walking into, lowest first: a generation
 * of the line ("Toyota Corolla (E210)"), then a variant of the same car (a
 * body style, a view, a region or a powertrain: "… (E210) sedan", "… (E210,
 * Japan)", "Toyota Corolla Hybrid (E210)"), then anything else.
 */
export function subcategoryRank(parent: string, subcategory: string): number {
  const rest = lower(subcategory).replace(lower(parent), "").trim();
  if (rest !== lower(subcategory)) {
    if (/^\(.*\)$/.test(rest) || /^(mk|gen|generation|series|phase)\s*\w+$/.test(rest) || /^\d{4}/.test(rest)) return 0;
    if (bodyOrView.test(rest.replace(/^\(.*?\)\s*/, ""))) return 1;
  }
  // Every word of the parent is in it: the same car, told apart by something else.
  const words = (text: string) => lower(text).split(/[^a-z0-9]+/).filter(Boolean);
  const own = new Set(words(subcategory));
  return words(parent).every((word) => own.has(word)) ? 1 : 2;
}

/**
 * Newer generations have bigger numbers ("(E210)" after "(E20)", "Mk8" after
 * "Mk7", "(2019)"): the biggest number in the subcategory's own words, to walk
 * the newest first.
 */
export function recencyHint(parent: string, subcategory: string): number {
  // "(tenth generation)" counts as 10.
  const rest = lower(subcategory)
    .replace(lower(parent), "")
    .replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\b/g, (word) =>
      String(ordinals.indexOf(word) + 1),
    );
  return Math.max(0, ...(rest.match(/\d+/g) ?? []).map(Number));
}
const ordinals = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];

/** Whether a file is named after the model ("2022 Fiat Pulse…"), not just a place ("Belo Horizonte 482.jpg"). */
export function namesTheModel(file: string, label: string): boolean {
  const name = ` ${lower(file).replace(/[^a-z0-9]+/g, " ")} `;
  // The label's words after the first (usually the brand): "Pulse", "Corolla", "DB9".
  const words = lower(label).replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(1).filter((word) => word.length >= 2);
  return words.length === 0 || words.some((word) => name.includes(` ${word} `) || name.includes(` ${word}`));
}

/**
 * Photos of one shoot share a name but for a number ("DB9 001 (2261257153)",
 * "DB12 Auto Zuerich 2023 1X7A1462"); a crop shares the original's name.
 */
export function seriesOf(file: string): string {
  return lower(file)
    .replace(/\.\w+$/, "")
    .replace(/\(cropped\)/g, "")
    // Long numbers and codes, but not a year: "2261257153", "1x7a1462", "20250401".
    .replace(/\b(?!(?:19|20)\d\d\b)[a-z\d]*\d{4,}[a-z\d]*\b/g, "#")
    .replace(/\(\s*#\s*\)/g, "#")
    .replace(/[^a-z\d#]+/g, " ")
    .trim();
}

/** The body style of a file: by its name, else the subcategory it was found in, else its categories. */
export function bodyOfFile(file: CommonsFile, label: string): GalleryBody | undefined {
  return (
    bodyOf(file.file.replace(/\.\w+$/, ""), label) ??
    (file.subcategory ? bodyOf(file.subcategory, label) : undefined) ??
    bodyOf(file.categories.join(" | "), label)
  );
}

const romans = new Set(["ii", "iii", "iv", "vi", "vii", "viii", "ix"]);
/** A generation's codes ("b9", "e210", "mk7", "iii"), not the words of the line's name. */
export function generationCodes(names: string, label: string): string[] {
  const own = new Set(lower(label).split(/[^a-z0-9]+/));
  return names
    .split(" ")
    .filter((word) => (/^(?:[a-z]{1,3}\d{1,3}[a-z]?|mk\d+)$/.test(word) || romans.has(word)) && !own.has(word));
}

/**
 * The gallery of a model line: per generation (or per five model years, for
 * lines without generations) and body style, the best photos of each angle.
 * A photo naming a generation's code ("A4 B9") goes to it; else by its year.
 * A photo with no year goes to the line's only generation, or to the whole
 * line when no photo of it has a year; otherwise it is left out.
 */
export function pickGallery(
  files: CommonsFile[],
  {
    label,
    generations = [],
    firstYear,
    now = new Date(),
  }: {
    label: string;
    generations?: ModelGeneration[];
    /** The line's oldest model year in the catalog: older photos are of no use. */
    firstYear?: number;
    now?: Date;
  },
): GalleryPhoto[] {
  const thisYear = now.getFullYear();
  // A generation with no end ends when a newer one starts.
  const starts = [...new Set(generations.map((generation) => generation.from).filter(Boolean))].sort((a, b) => a - b);
  const spans = generations
    .filter((generation) => generation.from)
    .map((generation) => ({
      from: generation.from,
      to: generation.to ?? starts.find((start) => start > generation.from) ?? thisYear + 1,
      codes: generationCodes(generation.names ?? "", label),
    }))
    .sort((a, b) => a.to - a.from - (b.to - b.from));
  const seen = new Set<string>();
  const usable: { file: CommonsFile; year?: number }[] = [];
  for (const file of files) {
    if (seen.has(file.file) || isNotTheCarFile(file.file) || file.categories.some(isNotTheCar)) continue;
    if (!namesTheModel(file.file, label)) continue;
    if (file.width < 800 || file.height < 500) continue;
    seen.add(file.file);
    const year = photoYear(file.file, file.categories, label);
    if (year !== undefined && (year > thisYear + 1 || (firstYear !== undefined && year < firstYear - 1))) continue;
    usable.push({ file, ...(year !== undefined && { year }) });
  }
  const anyYear = usable.some((photo) => photo.year !== undefined);

  const buckets = new Map<
    string,
    { span: { from: number; to: number }; photos: { file: CommonsFile; angle: Angle; body?: GalleryBody }[] }
  >();
  for (const { file, year } of usable) {
    let span: { from: number; to: number } | undefined;
    const words = new Set(lower(`${file.file} ${file.subcategory ?? ""}`).split(/[^a-z0-9]+/));
    const coded = spans.filter((item) => item.codes.some((code) => words.has(code)));
    if (coded.length) {
      span = coded.find((item) => year !== undefined && year >= item.from && year <= item.to) ?? coded[0];
    } else if (year !== undefined) {
      // The narrowest generation with that year; else its five-year window (2021–2025).
      const window = Math.floor((year - 1) / 5) * 5 + 1;
      span = spans.find((item) => year >= item.from && year <= item.to) ?? { from: window, to: window + 4 };
    } else if (spans.length === 1) {
      span = spans[0];
    } else if (!anyYear) {
      span = { from: 1900, to: thisYear + 1 };
    }
    if (!span) continue;
    // Sedan, hatch and untagged photos share the line's usual body; the others get their own.
    const body = bodyOfFile(file, label);
    const group = body === "sedan" || body === "hatch" ? "" : (body ?? "");
    const key = `${span.from}-${span.to}|${group}`;
    if (!buckets.has(key)) buckets.set(key, { span: { from: span.from, to: span.to }, photos: [] });
    buckets.get(key)!.photos.push({ file, angle: angleOf(file.file, file.categories), ...(body && { body }) });
  }

  const gallery: GalleryPhoto[] = [];
  for (const { span, photos } of buckets.values()) {
    // The best photo of each shoot and angle.
    const series = new Set<string>();
    const ranked = [...photos]
      .sort((a, b) => score(b.file, b.angle) - score(a.file, a.angle))
      .filter((photo) => {
        const key = `${photo.angle}|${seriesOf(photo.file.file)}`;
        if (series.has(key)) return false;
        series.add(key);
        return true;
      });
    const chosen: typeof photos = [];
    for (const [angle, count] of wanted) {
      chosen.push(...ranked.filter((photo) => photo.angle === angle).slice(0, count));
    }
    // Fill up with the best of the rest when an angle is missing.
    for (const photo of ranked) {
      if (chosen.length >= photosPerGeneration) break;
      if (!chosen.includes(photo)) chosen.push(photo);
    }
    const order = wanted.map(([angle]) => angle);
    chosen
      .slice(0, photosPerGeneration)
      .sort((a, b) => order.indexOf(a.angle) - order.indexOf(b.angle))
      .forEach(({ file, angle, body }) =>
        gallery.push({
          file: file.file,
          thumb: file.thumb,
          angle,
          ...(body && { body }),
          from: span.from,
          to: span.to,
          ...(file.artist && { artist: file.artist }),
          ...(file.license && { license: file.license }),
        }),
      );
  }
  return gallery;
}
