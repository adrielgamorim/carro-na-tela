// Picks a photo gallery per model line from its Wikimedia Commons category
// (npm run fetch:galeria): a few photos per generation, from different
// angles (front, rear, side, interior), by the file names and categories.

import type { ModelGeneration } from "./generations.ts";

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

/**
 * The model year a photo is of, from its name ("2022 Fiat Pulse…", "…Drive
 * 2023.jpg") or a category ("2019 Chevrolet Onix"). Numbers that are part of
 * the model's name ("Peugeot 2008") do not count.
 */
export function photoYear(file: string, categories: string[], modelLabel: string): number | undefined {
  const ownNumbers = new Set(modelLabel.match(/\d{4}/g) ?? []);
  const yearIn = (text: string) => {
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

/**
 * The gallery of a model line: per generation (or per five model years, for
 * lines without generations), the best photos of each angle. A photo with no
 * year goes to the line's only generation, or to the whole line when no photo
 * of it has a year; otherwise it is left out.
 */
export function pickGallery(
  files: CommonsFile[],
  { label, generations = [], now = new Date() }: { label: string; generations?: ModelGeneration[]; now?: Date },
): GalleryPhoto[] {
  const thisYear = now.getFullYear();
  const spans = generations
    .filter((generation) => generation.from)
    .map((generation) => ({ from: generation.from, to: generation.to ?? thisYear + 1 }))
    .sort((a, b) => a.to - a.from - (b.to - b.from));
  const seen = new Set<string>();
  const usable: { file: CommonsFile; year?: number }[] = [];
  for (const file of files) {
    if (seen.has(file.file) || isNotTheCarFile(file.file) || file.categories.some(isNotTheCar)) continue;
    if (file.width < 800 || file.height < 500) continue;
    seen.add(file.file);
    const year = photoYear(file.file, file.categories, label);
    if (year !== undefined && year > thisYear + 1) continue;
    usable.push({ file, ...(year !== undefined && { year }) });
  }
  const anyYear = usable.some((photo) => photo.year !== undefined);

  const buckets = new Map<string, { span: { from: number; to: number }; photos: { file: CommonsFile; angle: Angle }[] }>();
  for (const { file, year } of usable) {
    let span: { from: number; to: number } | undefined;
    if (year !== undefined) {
      // The narrowest generation with that year; else its five-year window (2021–2025).
      const window = Math.floor((year - 1) / 5) * 5 + 1;
      span = spans.find((item) => year >= item.from && year <= item.to) ?? { from: window, to: window + 4 };
    } else if (spans.length === 1) {
      span = spans[0];
    } else if (!anyYear) {
      span = { from: 1900, to: thisYear + 1 };
    }
    if (!span) continue;
    const key = `${span.from}-${span.to}`;
    if (!buckets.has(key)) buckets.set(key, { span, photos: [] });
    buckets.get(key)!.photos.push({ file, angle: angleOf(file.file, file.categories) });
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
      .forEach(({ file, angle }) =>
        gallery.push({
          file: file.file,
          thumb: file.thumb,
          angle,
          from: span.from,
          to: span.to,
          ...(file.artist && { artist: file.artist }),
          ...(file.license && { license: file.license }),
        }),
      );
  }
  return gallery;
}
