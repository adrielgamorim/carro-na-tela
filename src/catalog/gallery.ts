// Photo gallery of a model line (Wikimedia Commons, npm run fetch:galeria),
// one file per model in public/catalog/galeria, loaded by the version page.

export type GalleryAngle = "frente" | "traseira" | "lateral" | "interior" | "outra";
/** The body style a photo or a version names; none means the line's usual one. */
export type GalleryBody = "sedan" | "hatch" | "perua" | "picape" | "furgao" | "conversivel" | "cupe";

export interface GalleryPhoto {
  /** About 960 px wide. */
  thumb: string;
  /** Commons file page (author and license). */
  page: string;
  angle: GalleryAngle;
  body?: GalleryBody;
  /** Model years the photo is shown for. */
  from: number;
  to: number;
  artist?: string;
  license?: string;
}

export interface GalleryFile {
  photos: GalleryPhoto[];
}

export const angleLabels: Record<GalleryAngle, string> = {
  frente: "Frente",
  traseira: "Traseira",
  lateral: "Lateral",
  interior: "Interior",
  outra: "Outra",
};

/** Path of a model's gallery, relative to the catalog folder ("Q107108337"). */
export const galleryPath = (modelId: string) => `galeria/${modelId}.json`;

/** The photos of a model year (0 km counts as this year). */
export function photosOfYear(photos: GalleryPhoto[], modelYear: number | null, now = new Date()) {
  const year = modelYear ?? now.getFullYear();
  return photos.filter((photo) => year >= photo.from && year <= photo.to);
}

// The first that matches wins: "Logan MCV Van" is a van, "A4 Avant" a wagon.
const bodies: [GalleryBody, RegExp][] = [
  ["furgao", /\b(vans?|furgao|furgon|fourgon|kastenwagen)\b/],
  ["picape", /\b(pick ?ups?|picapes?|utes?|double cab|crew cab|single cab|cab(ine)? (dupla|simples|estendida))\b/],
  [
    "perua",
    /\b(mcv|avant|allroad|estates?|kombi|combi|wagons?|sw|touring|variant|sportwagen|sportwagon|break|tourer|weekend|shooting brake|sportbrake|caravan)\b/,
  ],
  ["conversivel", /\b(cabrio|cabriolet|convertibles?|conversivel|roadster|spyder|spider)\b/],
  ["cupe", /\b(coupes?|cupe)\b/],
  ["sedan", /\b(sedans?|seda|saloon|notchback)\b/],
  ["hatch", /\b(hatch|hatchback|sportback)\b/],
];

const plainWords = (text: string) =>
  ` ${text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    // "A4allroadDetroit".
    .replace(/allroad/g, " allroad ")
    .replace(/[^a-z0-9]+/g, " ")} `;

/**
 * The body style a text names ("Dacia Logan MCV Stepway" is a wagon), leaving
 * out the words of the line's own name ("Volkswagen Kombi" is the line).
 */
export function bodyOf(text: string, lineName = ""): GalleryBody | undefined {
  let words = plainWords(text);
  for (const word of plainWords(lineName).trim().split(" ").filter(Boolean)) words = words.replaceAll(` ${word} `, "  ");
  return bodies.find(([, pattern]) => pattern.test(words))?.[0];
}

/** The body style of a FIPE version: its name, or its cab ("Strada … CD") for a pickup. */
export function versionBody(name: string): GalleryBody | undefined {
  return bodyOf(name) ?? (/\b(cd|cs|ce)\b/.test(plainWords(name)) ? "picape" : undefined);
}

/**
 * The photos of a version's body style: the Logan sedan without the Logan
 * MCV, the A4 without the A4 Avant unless the version is one. A version
 * without a body in its name takes the untagged, sedan and hatch photos. With
 * fewer than three left, all of them.
 */
export function photosOfBody(photos: GalleryPhoto[], versionName: string): GalleryPhoto[] {
  const version = versionBody(versionName);
  const fits = ({ body }: GalleryPhoto) =>
    !body || body === version || (!version && (body === "sedan" || body === "hatch"));
  const kept = photos.filter(fits);
  return kept.length >= 3 ? kept : photos;
}

/** A bigger Commons thumbnail of the same file, for the enlarged view. */
export const largerThumb = (thumb: string, width: number) => thumb.replace(/\/\d+px-/, `/${width}px-`);
