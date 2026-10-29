// Downloads car models from Wikidata and, for the ones that match FIPE
// versions, the Portuguese Wikipedia summary and the image credits.
//
//   npm run fetch:wikidata -- [--cached] [--data=data/fipe] [--out=data/wikidata]
//
// Writes data/wikidata/models.json (every car model, for the matching in
// build:catalog) and data/wikidata/details.json (summary and credits by
// Wikidata id). Details already downloaded are kept; --cached reuses the
// models file instead of running the query again.

import { mkdir, readdir, readFile } from "node:fs/promises";
import { writeFileRetrying } from "../write-file.ts";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { selectLatestSnapshots } from "../catalog/catalog-index.ts";
import type { CrawlSnapshot } from "../catalog/catalog-index.ts";
import { getModelFamily } from "../../src/services/fipeParsing.ts";
import { fallbackKey, findFallback } from "./fallback.ts";
import { parseGenerations } from "./generations.ts";
import type { Generation, ModelGeneration } from "./generations.ts";
import { mergeSpecs, parseInfobox } from "./infobox.ts";
import type { InfoboxSpecs } from "./infobox.ts";
import { parseSpecRows, specsQuery } from "./specs.ts";
import type { FallbackFile, FallbackTitle } from "./fallback.ts";
import { createWikidataMatcher, findWikidataOverride, parseSparqlModels } from "./match.ts";
import type { WikidataModel, WikidataOverride } from "./match.ts";
import type { WikidataDetails } from "./details.ts";
import { versionYears } from "./details.ts";

const { values } = parseArgs({
  options: {
    cached: { type: "boolean", default: false },
    data: { type: "string", default: "data/fipe" },
    out: { type: "string", default: "data/wikidata" },
  },
});

// Wikimedia limits clients whose User-Agent has no contact (a URL or email) to 10 requests a minute.
const headers = { "User-Agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };
const modelsFile = join(values.out, "models.json");
const detailsFile = join(values.out, "details.json");
const fallbackFile = join(values.out, "fallback.json");

// Car models (Q3231690) and car model series (Q59773381: Golf, Uno, Hilux…),
// with their subclasses; and items typed only as a vehicle model (Q29048322:
// Renault Oroch), vehicle model series (Q29048319: Ford F-250) or truck model
// (Q21546143: Iveco Daily, VW Delivery), without subclasses, which would bring
// motorcycles and aircraft. Listing the ids is cheap; their data comes in
// batches, since one query for everything exceeds the 60 s limit of the query
// service.
const classes = [
  { id: "Q3231690", subclasses: true },
  { id: "Q59773381", subclasses: true },
  { id: "Q29048322", subclasses: false },
  { id: "Q29048319", subclasses: false },
  { id: "Q21546143", subclasses: false },
];
// One class per query: VALUES over the class makes the planner time out.
const idsQuery = ({ id, subclasses }: (typeof classes)[number]) =>
  `SELECT DISTINCT ?m WHERE { ?m wdt:P31${subclasses ? "/wdt:P279*" : ""} wd:${id} }`;
const dataQuery = (ids: string[]) => `
SELECT ?m ?en ?pt ?mul ?ptDesc
  (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases)
  (GROUP_CONCAT(DISTINCT ?brandName; separator="|") AS ?brands)
  (SAMPLE(?img) AS ?image) (SAMPLE(?ptw) AS ?ptwiki)
  (MIN(YEAR(?start)) AS ?from) (MAX(YEAR(?end)) AS ?to)
WHERE {
  VALUES ?m { ${ids.map((id) => `wd:${id}`).join(" ")} }
  OPTIONAL { ?m rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?m rdfs:label ?pt FILTER(LANG(?pt) = "pt") }
  # "mul" is the label for every language: items that have it often drop "en" and "pt" (Fiat Punto).
  OPTIONAL { ?m rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?m schema:description ?ptDesc FILTER(LANG(?ptDesc) = "pt") }
  OPTIONAL { ?m skos:altLabel ?alias FILTER(LANG(?alias) IN ("en", "pt", "pt-br", "mul")) }
  OPTIONAL { ?m wdt:P176|wdt:P1716 ?b . ?b rdfs:label ?brandName FILTER(LANG(?brandName) = "en") }
  OPTIONAL { ?m wdt:P18 ?img }
  OPTIONAL { ?ptw schema:about ?m ; schema:isPartOf <https://pt.wikipedia.org/> }
  OPTIONAL { ?m wdt:P2031 ?start }
  OPTIONAL { ?m wdt:P2032 ?end }
}
GROUP BY ?m ?en ?pt ?mul ?ptDesc`;

type SparqlRow = Record<string, { value: string }>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET/POST JSON; waits and retries when the server asks to slow down (429). */
async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { ...init, headers: { ...headers, ...init.headers } });
    if (response.status === 429 && attempt < 4) {
      const seconds = Number(response.headers.get("retry-after")) || 15 * attempt;
      console.warn(`Aviso: limite de requisições; aguardando ${seconds}s`);
      await wait(seconds * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} em ${url.slice(0, 120)}`);
    return (await response.json()) as T;
  }
}

async function sparql(text: string): Promise<SparqlRow[]> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await getJson<{ results: { bindings: SparqlRow[] } }>(
        "https://query.wikidata.org/sparql",
        {
          method: "POST",
          body: new URLSearchParams({ query: text, format: "json" }),
          headers: { Accept: "application/sparql-results+json" },
        },
      );
      return result.results.bindings;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`Aviso: ${(error as Error).message}; tentando de novo`);
      await wait(5000 * attempt);
    }
  }
}

async function loadModels(): Promise<WikidataModel[]> {
  if (values.cached) {
    const file = JSON.parse(await readFile(modelsFile, "utf8")) as { models: WikidataModel[] };
    return file.models;
  }
  console.log("Consultando o Wikidata…");
  const ids = new Set<string>();
  for (const wikidataClass of classes) {
    for (const row of await sparql(idsQuery(wikidataClass))) ids.add(row.m!.value.split("/").pop()!);
  }
  const rows: SparqlRow[] = [];
  const list = [...ids];
  // The query service may cut an answer short and still say 200: a batch that
  // comes back with too few items is split in halves and asked again.
  async function batch(batchIds: string[]): Promise<SparqlRow[]> {
    const found = await sparql(dataQuery(batchIds));
    const items = new Set(found.map((row) => row.m!.value));
    if (items.size >= batchIds.length * 0.9 || batchIds.length <= 50) return found;
    console.warn(`Aviso: ${items.size} de ${batchIds.length} itens; pedindo em duas metades`);
    const half = Math.ceil(batchIds.length / 2);
    return [...(await batch(batchIds.slice(0, half))), ...(await batch(batchIds.slice(half)))];
  }
  for (let start = 0; start < list.length; start += 2000) {
    rows.push(...(await batch(list.slice(start, start + 2000))));
    console.log(`  ${Math.min(start + 2000, list.length)} de ${list.length}`);
  }
  const models = parseSparqlModels(rows);
  await writeFileRetrying(
    modelsFile,
    `${JSON.stringify({ fetchedAt: new Date().toISOString(), models })}
`,
  );
  return models;
}

/** First sentences of a Wikipedia summary, up to about 360 characters. */
function shorten(extract: string): string {
  const sentences = extract.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [extract];
  let text = "";
  for (const sentence of sentences) {
    if (text && text.length + sentence.length > 360) break;
    text += sentence;
  }
  return text.trim();
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/**
 * Thumbnail, author and license of Commons files, 50 per request. Files of a
 * failed request are in `failed` (tried again next run); missing ones are in
 * neither.
 */
async function commonsCredits(files: string[]) {
  const credits = new Map<string, WikidataDetails>();
  const failed = new Set<string>();
  for (let start = 0; start < files.length; start += 50) {
    const batch = files.slice(start, start + 50);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "480",
      iiextmetadatafilter: "Artist|LicenseShortName",
      titles: batch.map((file) => `File:${file}`).join("|"),
    });
    try {
      const result = await getJson<{
        query?: {
          normalized?: { from: string; to: string }[];
          pages?: {
            title: string;
            imageinfo?: {
              thumburl?: string;
              extmetadata?: Record<string, { value: string } | undefined>;
            }[];
          }[];
        };
      }>(`https://commons.wikimedia.org/w/api.php?${params}`);
      const byTitle = new Map(
        (result.query?.pages ?? []).map((page) => [page.title, page.imageinfo?.[0]]),
      );
      // "File:a_b.jpg" comes back as "File:A b.jpg".
      const normalized = new Map((result.query?.normalized ?? []).map(({ from, to }) => [from, to]));
      for (const file of batch) {
        const title = `File:${file}`;
        const info = byTitle.get(normalized.get(title) ?? title);
        if (!info?.thumburl) continue;
        const artist = info.extmetadata?.Artist?.value;
        const license = info.extmetadata?.LicenseShortName?.value;
        credits.set(file, {
          thumb: info.thumburl,
          ...(artist && { artist: stripHtml(artist).slice(0, 120) }),
          ...(license && { license: stripHtml(license) }),
        });
      }
    } catch (error) {
      console.warn(`Aviso: créditos das imagens: ${(error as Error).message}`);
      for (const file of batch) failed.add(file);
    }
    await wait(500);
  }
  return { credits, failed };
}

await mkdir(values.out, { recursive: true });
const models = await loadModels();
console.log(`${models.length} modelos no Wikidata`);

const files = (await readdir(values.data)).filter((file) => file.endsWith(".json"));
const snapshots = await Promise.all(
  files.map(async (file) => JSON.parse(await readFile(join(values.data, file), "utf8")) as CrawlSnapshot),
);
const overrides = await readFile(join(values.out, "overrides.json"), "utf8")
  .then((text) => (JSON.parse(text) as { overrides: WikidataOverride[] }).overrides)
  .catch(() => [] as WikidataOverride[]);
const match = createWikidataMatcher(models, overrides);
const used = new Map<string, WikidataModel>();
const versions = new Map<string, { brand: string; model: string; years: number[] }>();
for (const snapshot of selectLatestSnapshots(snapshots)) {
  for (const vehicle of snapshot.vehicles) {
    const key = `${vehicle.brand}|${vehicle.model}`;
    const version = versions.get(key) ?? { brand: vehicle.brand, model: vehicle.model, years: [] };
    version.years.push(...versionYears([vehicle.yearCode]));
    versions.set(key, version);
  }
}
let matched = 0;
// Lines with no picture from Wikidata (no model, or a model without an
// image), for the Wikipedia/Commons fallback. A manual "none" means no
// picture on purpose, so those are left out.
const unmatchedLines = new Map<string, { brand: string; family: string }>();
for (const version of versions.values()) {
  const model = match(version);
  if (model) {
    matched += 1;
    used.set(model.id, model);
  }
  if (model?.image || (!model && findWikidataOverride(overrides, version)?.none)) continue;
  const family = getModelFamily(version.model);
  unmatchedLines.set(fallbackKey(version.brand, family), { brand: version.brand, family });
}
console.log(`${matched} de ${versions.size} versões FIPE casadas com ${used.size} modelos`);

const details: Record<string, WikidataDetails> = await readFile(detailsFile, "utf8")
  .then((text) => JSON.parse(text) as Record<string, WikidataDetails>)
  .catch(() => ({}));
const missing = [...used.values()].filter((model) => !details[model.id]);
console.log(`Buscando resumo e créditos de ${missing.length} modelos`);

// A model is saved only when every request for it worked, so a failed one is
// tried again on the next run. Requests go one at a time: Wikimedia answers
// 429 to bursts.
const imageCredits = await commonsCredits(missing.flatMap((model) => (model.image ? [model.image] : [])));
const credits = new Map<string, WikidataDetails>();
const failed = new Set<string>();
for (const model of missing) {
  if (!model.image) continue;
  const credit = imageCredits.credits.get(model.image);
  if (credit) credits.set(model.id, credit);
  if (imageCredits.failed.has(model.image)) failed.add(model.id);
}

let done = 0;
for (const model of missing) {
  if (failed.has(model.id)) continue;
  const entry: WikidataDetails = { ...credits.get(model.id) };
  if (model.ptwiki) {
    try {
      const summary = await getJson<{ extract?: string }>(
        `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(model.ptwiki.replace(/ /g, "_"))}`,
      );
      if (summary.extract) entry.extract = shorten(summary.extract);
    } catch (error) {
      const message = (error as Error).message;
      console.warn(`Aviso: ${model.label}: ${message}`);
      // A missing article stays missing; anything else is tried again next run.
      if (!message.startsWith("404")) continue;
    }
    await wait(250);
  }
  details[model.id] = entry;
  done += 1;
  if (done % 100 === 0) console.log(`  ${done} de ${missing.length}`);
}

await writeFileRetrying(detailsFile, `${JSON.stringify(details, null, 1)}\n`);
console.log(`Detalhes em ${detailsFile}: ${Object.keys(details).length} modelos`);

// Size and mass of the matched models: one small query per 200 models, so
// they are simply fetched again on every run.
const specsFile = join(values.out, "specs.json");
const usedIds = [...used.keys()].sort();
const specRows = [];
for (let start = 0; start < usedIds.length; start += 200) {
  specRows.push(...(await sparql(specsQuery(usedIds.slice(start, start + 200)))));
}
const wikidataSpecs = parseSpecRows(specRows);
// English article titles, for the infoboxes (the Portuguese ones are in models.json).
const enTitles = new Map<string, string>();
for (let start = 0; start < usedIds.length; start += 200) {
  const rows = await sparql(`SELECT ?m ?title WHERE {
  VALUES ?m { ${usedIds.slice(start, start + 200).map((id) => `wd:${id}`).join(" ")} }
  ?article schema:about ?m ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title .
}`);
  for (const row of rows) {
    const id = row.m?.value.split("/").pop();
    if (id && row.title) enTitles.set(id, row.title.value);
  }
}

// Fallback: each line is searched once; "nothing fits" (null) is kept too.
const fallback: FallbackFile = await readFile(fallbackFile, "utf8")
  .then((text) => JSON.parse(text) as FallbackFile)
  .catch(() => ({}));
const titles = await readFile(join(values.out, "fallback-titles.json"), "utf8")
  .then((text) => (JSON.parse(text) as { titles: FallbackTitle[] }).titles)
  .catch(() => [] as FallbackTitle[]);
// A line chosen by hand is fetched again whenever its cached source differs.
const sourceId = (source: string) =>
  source.startsWith("commons:") ? source : `wikipedia:${source}`;
for (const { brand, family, source } of titles) {
  const key = fallbackKey(brand, family);
  if (key in fallback && fallback[key]?.id !== sourceId(source)) delete fallback[key];
}
const toSearch = [...unmatchedLines].filter(([key]) => !(key in fallback));
console.log(
  `Reserva (Wikipedia/Commons): ${unmatchedLines.size} linhas sem foto do Wikidata, ${toSearch.length} para buscar`,
);
// Up to six requests per line: spaced out, since Wikimedia answers bursts
// with a minute-long 429.
const politeGetJson = async <T,>(url: string): Promise<T> => {
  await wait(700);
  return getJson<T>(url);
};
const saveFallback = () => writeFileRetrying(fallbackFile, `${JSON.stringify(fallback, null, 1)}\n`);
let searched = 0;
for (const [key, { brand, family }] of toSearch) {
  try {
    fallback[key] = await findFallback(politeGetJson, brand, family, titles);
  } catch (error) {
    // Not saved: tried again on the next run.
    console.warn(`Aviso: reserva de ${brand} ${family}: ${(error as Error).message}`);
  }
  searched += 1;
  // Saved as it goes: an interrupted run keeps what it found.
  if (searched % 10 === 0) {
    await saveFallback();
    console.log(`  ${searched} de ${toSearch.length}`);
  }
}
await saveFallback();
const found = [...unmatchedLines.keys()].filter((key) => fallback[key]).length;
console.log(`Reserva em ${fallbackFile}: ${found} de ${unmatchedLines.size} linhas com foto`);

// Size, mass and power: Wikidata first, then the infobox of the Portuguese and
// the English article. Each article is read once (data/wikidata/infobox.json;
// an empty entry means nothing usable); delete an entry to read it again.
const infoboxFile = join(values.out, "infobox.json");
const infoboxes: Record<string, InfoboxSpecs> = await readFile(infoboxFile, "utf8")
  .then((text) => JSON.parse(text) as Record<string, InfoboxSpecs>)
  .catch(() => ({}));
const articlesOf = new Map<string, string[]>();
for (const id of usedIds) {
  const model = used.get(id);
  const articles = [model?.ptwiki && `pt:${model.ptwiki}`, enTitles.has(id) && `en:${enTitles.get(id)}`];
  articlesOf.set(id, articles.filter((article): article is string => typeof article === "string"));
}
// Fallback pictures that came from a Wikipedia article: "wikipedia:pt:Fiat Punto".
for (const info of Object.values(fallback)) {
  if (info?.id.startsWith("wikipedia:")) articlesOf.set(info.id, [info.id.slice("wikipedia:".length)]);
}
const toRead = [...new Set([...articlesOf.values()].flat())].filter((article) => !(article in infoboxes));
console.log(`Infobox da Wikipedia: ${toRead.length} artigos para ler`);
let read = 0;
for (const article of toRead) {
  const [lang, ...rest] = article.split(":");
  const params = new URLSearchParams({
    action: "parse",
    page: rest.join(":"),
    prop: "wikitext",
    section: "0",
    redirects: "1",
    format: "json",
    formatversion: "2",
  });
  try {
    const result = await politeGetJson<{ parse?: { wikitext?: string } }>(
      `https://${lang}.wikipedia.org/w/api.php?${params}`,
    );
    infoboxes[article] = parseInfobox(result.parse?.wikitext ?? "");
  } catch (error) {
    // Not saved: read again on the next run.
    console.warn(`Aviso: infobox de ${article}: ${(error as Error).message}`);
  }
  read += 1;
  if (read % 25 === 0) {
    await writeFileRetrying(infoboxFile, `${JSON.stringify(infoboxes, null, 1)}\n`);
    console.log(`  ${read} de ${toRead.length}`);
  }
}
await writeFileRetrying(infoboxFile, `${JSON.stringify(infoboxes, null, 1)}\n`);

const specs: Record<string, InfoboxSpecs> = {};
for (const [id, articles] of articlesOf) {
  const merged = mergeSpecs(wikidataSpecs[id], ...articles.map((article) => infoboxes[article]));
  if (Object.keys(merged).length) specs[id] = merged;
}
await writeFileRetrying(specsFile, `${JSON.stringify(specs, null, 1)}\n`);
console.log(`Dimensões, peso e potência em ${specsFile}: ${Object.keys(specs).length} modelos`);

// One photo per generation (generations.ts), from the infoboxes of the same
// articles, read in full this time. Each article is read once
// (data/wikidata/generation-articles.json; an empty list means one infobox or
// none) and each file's credits fetched once (generation-photos.json; null
// means no such file). The result, per model and in the order of its
// articles (Portuguese first), goes to data/wikidata/generations.json.
const articleGenerationsFile = join(values.out, "generation-articles.json");
const articleGenerations: Record<string, Generation[]> = await readFile(articleGenerationsFile, "utf8")
  .then((text) => JSON.parse(text) as Record<string, Generation[]>)
  .catch(() => ({}));
// Lists saved before names were kept are read again.
const toParse = [...new Set([...articlesOf.values()].flat())].filter(
  (article) => !(article in articleGenerations) || articleGenerations[article]?.some(({ names }) => names === undefined),
);
console.log(`Gerações na Wikipedia: ${toParse.length} artigos para ler`);
const saveArticleGenerations = () =>
  writeFileRetrying(articleGenerationsFile, `${JSON.stringify(articleGenerations, null, 1)}\n`);
let parsed = 0;
for (const article of toParse) {
  const [lang, ...rest] = article.split(":");
  const params = new URLSearchParams({
    action: "parse",
    page: rest.join(":"),
    prop: "wikitext",
    redirects: "1",
    format: "json",
    formatversion: "2",
  });
  try {
    const result = await politeGetJson<{ parse?: { wikitext?: string } }>(
      `https://${lang}.wikipedia.org/w/api.php?${params}`,
    );
    articleGenerations[article] = parseGenerations(result.parse?.wikitext ?? "");
  } catch (error) {
    // Not saved: read again on the next run.
    console.warn(`Aviso: gerações de ${article}: ${(error as Error).message}`);
  }
  parsed += 1;
  if (parsed % 25 === 0) {
    await saveArticleGenerations();
    console.log(`  ${parsed} de ${toParse.length}`);
  }
}
await saveArticleGenerations();

const generationPhotosFile = join(values.out, "generation-photos.json");
const generationPhotos: Record<string, WikidataDetails | null> = await readFile(generationPhotosFile, "utf8")
  .then((text) => JSON.parse(text) as Record<string, WikidataDetails | null>)
  .catch(() => ({}));
const newFiles = [
  ...new Set(Object.values(articleGenerations).flatMap((generations) => generations.map(({ file }) => file))),
].filter((file) => !(file in generationPhotos));
const newCredits = await commonsCredits(newFiles);
for (const file of newFiles) {
  if (!newCredits.failed.has(file)) generationPhotos[file] = newCredits.credits.get(file) ?? null;
}
await writeFileRetrying(generationPhotosFile, `${JSON.stringify(generationPhotos, null, 1)}\n`);

const generations: Record<string, ModelGeneration[]> = {};
for (const [id, articles] of articlesOf) {
  const list = articles.flatMap((article) =>
    (articleGenerations[article] ?? []).flatMap(({ file, from, to, names }): ModelGeneration[] => {
      const photo = generationPhotos[file];
      return photo ? [{ file, from, to, ...(names && { names }), ...photo }] : [];
    }),
  );
  if (list.length) generations[id] = list;
}
const generationsFile = join(values.out, "generations.json");
await writeFileRetrying(generationsFile, `${JSON.stringify(generations, null, 1)}\n`);
console.log(
  `Fotos por geração em ${generationsFile}: ${Object.keys(generations).length} modelos, ` +
    `${new Set(Object.values(generations).flat().map(({ file }) => file)).size} fotos`,
);
