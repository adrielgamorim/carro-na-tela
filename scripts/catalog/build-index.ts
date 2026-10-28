// Builds public/catalog/index.json from the crawl snapshots in data/fipe.
//
//   npm run build:catalog -- [--data=data/fipe] [--pbev=data/inmetro]
//                            [--wikidata=data/wikidata] [--frota=data/frota]
//                            [--imprensa=data/imprensa] [--fichas=data/fichas]
//                            [--out=public/catalog]
//
// INMETRO tables (data/inmetro/pbev-<year>.json, from npm run parse:pbev) are
// optional: without them the index has FIPE data only. So are the Wikidata
// models (data/wikidata, from npm run fetch:wikidata) and the Senatran fleet
// (data/frota, from npm run fetch:frota), and so are the press release
// figures reviewed in data/imprensa/stellantis.json and the spec sheets read
// in data/fichas/fichas.json (npm run fichas:ler).

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { buildCatalogIndex } from "./catalog-index.ts";
import { splitCatalogIndex } from "../../src/catalog/indexShards.ts";
import type { CrawlSnapshot, InmetroOverride } from "./catalog-index.ts";
import type { PbevRow } from "../../src/catalog/inmetro.ts";
import type { WikidataDetails } from "../wikidata/details.ts";
import type { WikidataModel, WikidataOverride } from "../wikidata/match.ts";
import type { FleetFile } from "../frota/frota.ts";
import type { PressFactsFile } from "../imprensa/facts.ts";
import type { ReadSheetsFile } from "../fichas/sheets.ts";
import { fallbackKey } from "../wikidata/fallback.ts";
import type { FallbackFile, FallbackTitle } from "../wikidata/fallback.ts";
import type { ModelSpecs } from "../../src/catalog/wikidata.ts";
import type { ModelGeneration } from "../wikidata/generations.ts";
import type { GalleryPhoto as GalleryPhotoData } from "../wikidata/gallery.ts";
import { commonsFile } from "../wikidata/details.ts";
import { galleryPath } from "../../src/catalog/gallery.ts";
import type { GalleryFile } from "../../src/catalog/gallery.ts";

const { values } = parseArgs({
  options: {
    data: { type: "string", default: "data/fipe" },
    out: { type: "string", default: "public/catalog" },
    pbev: { type: "string", default: "data/inmetro" },
    wikidata: { type: "string", default: "data/wikidata" },
    frota: { type: "string", default: "data/frota" },
    imprensa: { type: "string", default: "data/imprensa" },
    fichas: { type: "string", default: "data/fichas" },
  },
});

const files = (await readdir(values.data)).filter((file) => file.endsWith(".json"));
if (files.length === 0) {
  throw new Error(`Nenhum snapshot em ${values.data}. Rode npm run crawl:fipe antes.`);
}

const snapshots: CrawlSnapshot[] = await Promise.all(
  files.map(async (file) =>
    JSON.parse(await readFile(join(values.data, file), "utf8")) as CrawlSnapshot,
  ),
);
const pbevFiles = await readdir(values.pbev)
  .then((names) => names.filter((name) => /^pbev-\d{4}\.json$/.test(name)))
  .catch(() => [] as string[]);
const pbev: PbevRow[] = [];
for (const file of pbevFiles) {
  pbev.push(...(JSON.parse(await readFile(join(values.pbev, file), "utf8")) as PbevRow[]));
}
console.log(
  pbev.length === 0
    ? `Sem tabelas INMETRO em ${values.pbev}; índice só com dados FIPE.`
    : `Tabelas INMETRO: ${pbevFiles.length} anos, ${pbev.length} versões`,
);
const overridesFile = join(values.pbev, "overrides.json");
const overrides = await readFile(overridesFile, "utf8")
  .then((text) => (JSON.parse(text) as { overrides: InmetroOverride[] }).overrides)
  .catch(() => [] as InmetroOverride[]);
if (overrides.length > 0) console.log(`Ajustes manuais INMETRO: ${overrides.length}`);
const wikidataDir = values.wikidata;
const wikidata = await readFile(join(wikidataDir, "models.json"), "utf8")
  .then(async (text) => ({
    models: (JSON.parse(text) as { models: WikidataModel[] }).models,
    details: await readFile(join(wikidataDir, "details.json"), "utf8")
      .then((details) => JSON.parse(details) as Record<string, WikidataDetails>)
      .catch(() => ({})),
    overrides: await readFile(join(wikidataDir, "overrides.json"), "utf8")
      .then((file) => (JSON.parse(file) as { overrides: WikidataOverride[] }).overrides)
      .catch(() => [] as WikidataOverride[]),
    fallback: await readFile(join(wikidataDir, "fallback.json"), "utf8")
      .then((file) => JSON.parse(file) as FallbackFile)
      .catch(() => ({}) as FallbackFile),
    chosenFallbacks: await readFile(join(wikidataDir, "fallback-titles.json"), "utf8")
      .then((file) => (JSON.parse(file) as { titles: FallbackTitle[] }).titles.map(({ brand, family }) => fallbackKey(brand, family)))
      .catch(() => [] as string[]),
    specs: await readFile(join(wikidataDir, "specs.json"), "utf8")
      .then((file) => JSON.parse(file) as Record<string, ModelSpecs>)
      .catch(() => ({})),
    generations: await readFile(join(wikidataDir, "generations.json"), "utf8")
      .then((file) => JSON.parse(file) as Record<string, ModelGeneration[]>)
      .catch(() => ({})),
  }))
  .catch(() => undefined);
if (!wikidata) console.log(`Sem modelos do Wikidata em ${wikidataDir}; rode npm run fetch:wikidata.`);
const fleet = await readFile(join(values.frota, "frota.json"), "utf8")
  .then((text) => JSON.parse(text) as FleetFile)
  .catch(() => undefined);
if (!fleet) console.log(`Sem frota da Senatran em ${values.frota}; rode npm run fetch:frota.`);
const press = await readFile(join(values.imprensa, "stellantis.json"), "utf8")
  .then((text) => (JSON.parse(text) as PressFactsFile).facts)
  .catch(() => undefined);
const sheets = await readFile(join(values.fichas, "fichas.json"), "utf8")
  .then((text) => (JSON.parse(text) as ReadSheetsFile).sheets)
  .catch(() => undefined);
const index = buildCatalogIndex(snapshots, {
  pbev,
  overrides,
  onWarning: (message) => console.warn(`Aviso: ${message}`),
  wikidata,
  fleet,
  press,
  sheets,
});

// Photo galleries (npm run fetch:galeria): one file per model, loaded by the
// version page; the index only says how many photos a model has.
const gallery = await readFile(join(wikidataDir, "gallery.json"), "utf8")
  .then((text) => JSON.parse(text) as Record<string, GalleryPhotoData[]>)
  .catch(() => ({}) as Record<string, GalleryPhotoData[]>);
const galleryDir = join(values.out, "galeria");
await rm(galleryDir, { recursive: true, force: true });
await mkdir(galleryDir, { recursive: true });
let galleryPhotos = 0;
for (const model of index.models ?? []) {
  const photos = gallery[model.id];
  if (!photos?.length) continue;
  const file: GalleryFile = {
    photos: photos.map(({ file, ...photo }) => ({ ...photo, page: commonsFile(file) })),
  };
  await writeFile(join(values.out, galleryPath(model.id)), JSON.stringify(file));
  model.gallery = photos.length;
  galleryPhotos += photos.length;
}

const json = JSON.stringify(index);

await mkdir(values.out, { recursive: true });
const outFile = join(values.out, "index.json");
await writeFile(outFile, json);

// One slice per category and brand, for the Consulta FIPE (src/catalog/indexShards.ts).
const shardDir = join(values.out, "marcas");
await rm(shardDir, { recursive: true, force: true });
await mkdir(shardDir, { recursive: true });
const shards = splitCatalogIndex(index);
let largestShard = 0;
for (const [path, shard] of shards) {
  const text = JSON.stringify(shard);
  largestShard = Math.max(largestShard, text.length);
  await writeFile(join(values.out, path), text);
}

for (const snapshot of index.snapshots) {
  console.log(
    `${snapshot.category} ${snapshot.referenceMonth ?? snapshot.reference}: ` +
      `${snapshot.listed} versões-ano de ${snapshot.brands.length} marcas, ` +
      `${snapshot.priced} com preço` +
      (snapshot.listingComplete ? "" : " (listagem incompleta)") +
      (snapshot.inmetroMatched === undefined
        ? ""
        : `, ${snapshot.inmetroMatched} versões com dados INMETRO`),
  );
}
if (index.models) {
  const matched = index.versions.filter((version) => version.w !== undefined).length;
  const withImage = index.models.filter((model) => model.image).length;
  console.log(
    `Wikidata: ${matched} versões casadas com ${index.models.length} modelos (${withImage} com imagem)`,
  );
}
if (index.fleet) {
  const matched = index.versions.filter((version) => version.p !== undefined).length;
  console.log(
    `Frota Senatran (${index.fleet.reference}): ${matched} versões em ${index.fleet.lines.length} linhas de modelo`,
  );
}
if (galleryPhotos) {
  const models = (index.models ?? []).filter((model) => model.gallery).length;
  console.log(`Galeria: ${galleryPhotos} fotos de ${models} modelos em ${galleryDir}`);
}
if (index.sheets) {
  const years = index.versions.flatMap((version) => version.t ?? []).filter((sheet) => sheet >= 0).length;
  console.log(`Fichas técnicas: ${index.sheets.length} casadas com ${years} anos-modelo de ${index.versions.filter((version) => version.t).length} versões`);
}
if (index.press) {
  const years = index.versions.flatMap((version) => version.r ?? []);
  console.log(
    `Releases: ${index.press.length} dados em ${index.versions.filter((version) => version.r).length} versões ` +
      `(${years.filter(([trunk]) => trunk >= 0).length} anos com porta-malas, ${years.filter(([, torque]) => torque >= 0).length} com torque)`,
  );
}
console.log(
  `${shards.size} arquivos por marca em ${shardDir} (maior: ${(largestShard / 1024).toFixed(0)} KB)`,
);
console.log(
  `${index.versions.length} versões em ${outFile} (${(json.length / 1024).toFixed(0)} KB)`,
);
