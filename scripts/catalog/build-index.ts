// Builds public/catalog/index.json from the crawl snapshots in data/fipe.
//
//   npm run build:catalog -- [--data=data/fipe] [--pbev=data/inmetro]
//                            [--wikidata=data/wikidata] [--frota=data/frota]
//                            [--out=public/catalog]
//
// INMETRO tables (data/inmetro/pbev-<year>.json, from npm run parse:pbev) are
// optional: without them the index has FIPE data only. So are the Wikidata
// models (data/wikidata, from npm run fetch:wikidata) and the Senatran fleet
// (data/frota, from npm run fetch:frota).

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
import type { FallbackFile } from "../wikidata/fallback.ts";
import type { ModelSpecs } from "../../src/catalog/wikidata.ts";
import type { ModelGeneration } from "../wikidata/generations.ts";

const { values } = parseArgs({
  options: {
    data: { type: "string", default: "data/fipe" },
    out: { type: "string", default: "public/catalog" },
    pbev: { type: "string", default: "data/inmetro" },
    wikidata: { type: "string", default: "data/wikidata" },
    frota: { type: "string", default: "data/frota" },
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
const index = buildCatalogIndex(snapshots, {
  pbev,
  overrides,
  onWarning: (message) => console.warn(`Aviso: ${message}`),
  wikidata,
  fleet,
});
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
console.log(
  `${shards.size} arquivos por marca em ${shardDir} (maior: ${(largestShard / 1024).toFixed(0)} KB)`,
);
console.log(
  `${index.versions.length} versões em ${outFile} (${(json.length / 1024).toFixed(0)} KB)`,
);
