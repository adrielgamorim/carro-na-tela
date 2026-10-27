// Fallback pictures for catalog lines the Wikidata matching leaves without a
// model (Fiat Punto, Iveco Daily, Citroën Basalt…): the Wikipedia article of
// "<brand> <line>" (Portuguese, then English), else a Wikimedia Commons file.
// Both are free and CC-licensed, credited like the Wikidata pictures. A result
// is accepted only when its title names the brand and the line, so a search
// that drifts to another model ("JAC T40" → "JAC Refine S2") gives nothing.

import type { CatalogModelInfo } from "../../src/catalog/wikidata.ts";
import { brandNames } from "./match.ts";

export type GetJson = <T>(url: string) => Promise<T>;

/** data/wikidata/fallback.json: line key → picture, or null when nothing fits. */
export type FallbackFile = Record<string, CatalogModelInfo | null>;

export const fallbackKey = (brand: string, family: string) => `${brand}\n${family}`;

const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

// Words of a FIPE family that do not tell the line apart.
const genericWords = new Set(["GRAND", "NEW", "NOVO", "NOVA", "THE", "SUV", "VAN", "PICKUP", "PIK"]);

// Brands whose names are common words: a search finds villages ("Wake"),
// people ("Rely") or paintings ("Baby Buggy") instead of cars.
const wordBrands = new Set(["ARROW", "BABY", "BRM", "FEVER", "FYBER", "JPX", "RELY", "TAC", "WAKE", "WALK"]);
// Brands with Wikipedia articles of their own, but whose name is a word in
// file names: "RAM 2500" found a museum amulet of a ram, item 2500.
const commonsWordBrands = new Set(["RAM"]);

/** Name used to search for the brand ("VW - VolksWagen" → "Volkswagen"). */
export function searchBrand(brand: string): string {
  return brandNames[brand]?.[0] ?? brand;
}

/**
 * A title fits when it has one of the brand's names and the line's most
 * telling word ("Fiat Siena" fits "Grand Siena"; "JAC Refine S2" does not fit "T40").
 */
export function titleFits(title: string, brand: string, family: string): boolean {
  const titleWords = words(title);
  // Word by word, so "RAM" is not found inside "BRAMPTON"; "VW - VolksWagen"
  // counts by any of its names.
  const brands = [brand, ...(brandNames[brand] ?? [])].map(words);
  const hasBrand = brands.some((name) =>
    titleWords.some((_, start) => name.length > 0 && name.every((word, offset) => titleWords[start + offset] === word)),
  );
  if (!hasBrand) return false;
  const lineWords = words(family).filter((word) => !genericWords.has(word));
  const key = [...lineWords].sort((a, b) => b.length - a.length)[0];
  // One letter ("BMW M") is no line name; numbers are ("MG 4", "Omoda 5").
  if (key === undefined || (key.length < 2 && !/^\d$/.test(key))) return false;
  return titleWords.some((word) => word === key || word.startsWith(key));
}

const pictureFile = /\.(jpe?g|png|webp)$/i;
const stripHtml = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const commonsPage = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

/** First sentences of a summary, up to about 360 characters. */
function shorten(extract: string): string {
  const sentences = extract.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [extract];
  let text = "";
  for (const sentence of sentences) {
    if (text && text.length + sentence.length > 360) break;
    text += sentence;
  }
  return text.trim();
}

/** 480 px thumbnail, author and license of a Commons file. */
async function commonsImage(getJson: GetJson, file: string): Promise<CatalogModelInfo["image"] | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "480",
    iiextmetadatafilter: "Artist|LicenseShortName",
    titles: `File:${file}`,
  });
  const result = await getJson<{
    query?: { pages?: { imageinfo?: { thumburl?: string; extmetadata?: Record<string, { value: string } | undefined> }[] }[] };
  }>(`https://commons.wikimedia.org/w/api.php?${params}`);
  const info = result.query?.pages?.[0]?.imageinfo?.[0];
  if (!info?.thumburl) return null;
  const artist = info.extmetadata?.Artist?.value;
  const license = info.extmetadata?.LicenseShortName?.value;
  return {
    thumb: info.thumburl,
    page: commonsPage(file),
    ...(artist && { artist: stripHtml(artist).slice(0, 120) }),
    ...(license && { license: stripHtml(license) }),
  };
}

/**
 * File name of an upload.wikimedia.org URL: ".../e/e2/Car.jpg", or a
 * thumbnail ".../thumb/e/e2/Car.jpg/3840px-Car.jpg?utm_source=…", which is
 * what Wikipedia summaries give as the "original" image.
 */
export function commonsFileOf(source: string): string {
  const parts = new URL(source).pathname.split("/");
  const name = parts.includes("thumb") ? parts.at(-2) : parts.at(-1);
  return decodeURIComponent(name ?? "");
}

interface Summary {
  type?: string;
  title?: string;
  extract?: string;
  originalimage?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

async function fromWikipedia(
  getJson: GetJson,
  lang: "pt" | "en",
  brand: string,
  family: string,
): Promise<CatalogModelInfo | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    list: "search",
    srsearch: `${searchBrand(brand)} ${family}`,
    srlimit: "5",
    srnamespace: "0",
  });
  const search = await getJson<{ query?: { search?: { title: string }[] } }>(
    `https://${lang}.wikipedia.org/w/api.php?${params}`,
  );
  const title = search.query?.search?.find((hit) => titleFits(hit.title, brand, family))?.title;
  return title ? fromArticle(getJson, lang, title) : null;
}

/** The picture (and, in Portuguese, the summary) of one Wikipedia article. */
async function fromArticle(
  getJson: GetJson,
  lang: "pt" | "en",
  title: string,
): Promise<CatalogModelInfo | null> {
  const summary = await getJson<Summary>(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
  );
  if (summary.type === "disambiguation" || !summary.originalimage) return null;
  const file = commonsFileOf(summary.originalimage.source);
  if (!pictureFile.test(file)) return null;
  const image = await commonsImage(getJson, file);
  if (!image) return null;
  return {
    id: `wikipedia:${lang}:${summary.title ?? title}`,
    label: summary.title ?? title,
    // English text would read oddly in the app; the English article still gives the picture.
    ...(lang === "pt" && summary.extract && { description: shorten(summary.extract) }),
    ...(summary.content_urls?.desktop?.page && { wikipedia: summary.content_urls.desktop.page }),
    image,
  };
}

async function fromCommons(getJson: GetJson, brand: string, family: string): Promise<CatalogModelInfo | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    list: "search",
    srsearch: `${searchBrand(brand)} ${family}`,
    srlimit: "10",
    srnamespace: "6",
  });
  const search = await getJson<{ query?: { search?: { title: string }[] } }>(
    `https://commons.wikimedia.org/w/api.php?${params}`,
  );
  const hit = search.query?.search?.find(
    ({ title }) => pictureFile.test(title) && titleFits(title.replace(/^File:/, ""), brand, family),
  );
  if (!hit) return null;
  const file = hit.title.replace(/^File:/, "");
  const image = await commonsImage(getJson, file);
  if (!image) return null;
  return { id: `commons:${file}`, label: `${searchBrand(brand)} ${family}`, image };
}

/**
 * A source chosen by hand (data/wikidata/fallback-titles.json) for a line the
 * search gets wrong: "pt:Opel Zafira" (a Wikipedia article) or
 * "commons:Neta X 002.jpg" (a file).
 */
export interface FallbackTitle {
  brand: string;
  family: string;
  source: string;
  reason?: string;
}

async function fromSource(getJson: GetJson, source: string, label: string): Promise<CatalogModelInfo | null> {
  const [kind, ...rest] = source.split(":");
  const name = rest.join(":");
  if (kind === "pt" || kind === "en") return fromArticle(getJson, kind, name);
  if (kind !== "commons") throw new Error(`Fonte inválida em fallback-titles.json: ${source}`);
  const image = await commonsImage(getJson, name);
  return image ? { id: `commons:${name}`, label, image } : null;
}

/** Wikipedia (pt, then en), else Commons; null when nothing fits. */
export async function findFallback(
  getJson: GetJson,
  brand: string,
  family: string,
  titles: FallbackTitle[] = [],
): Promise<CatalogModelInfo | null> {
  const chosen = titles.find((item) => item.brand === brand && item.family === family);
  if (chosen) return fromSource(getJson, chosen.source, `${searchBrand(brand)} ${family}`);
  if (wordBrands.has(words(brand).join(""))) return null;
  // "SERES / SERES": the family is just the brand again.
  if (words(family).join("") === words(brand).join("")) return null;
  return (
    (await fromWikipedia(getJson, "pt", brand, family)) ??
    (await fromWikipedia(getJson, "en", brand, family)) ??
    (commonsWordBrands.has(words(brand).join("")) ? null : await fromCommons(getJson, brand, family))
  );
}

/**
 * Whether a line's fallback picture may stand in for a Wikidata model without
 * an image: the fallback title must name the model ("Toyota Hilux" for
 * "Toyota Hilux SW4"). FIPE families can be broad ("Volvo XC" covers the XC40,
 * XC60 and XC90), so the line alone is not enough.
 */
export function fallbackFitsModel(fallbackLabel: string, modelLabel: string, brand: string): boolean {
  // The brand is in both titles ("Volvo XC90", "Volvo EX40") and tells nothing.
  const brandWords = new Set([brand, ...(brandNames[brand] ?? [])].flatMap(words));
  const modelWords = new Set(words(modelLabel));
  return words(fallbackLabel).some(
    (word) =>
      modelWords.has(word) &&
      !brandWords.has(word) &&
      !genericWords.has(word) &&
      (word.length >= 3 || /\d/.test(word)),
  );
}
