// Crawls the FIPE catalog into data/fipe/<category>-<reference>.json.
//
//   npm run crawl:fipe -- [--phase=all|listing] [--offline] [--reference=338]
//                         [--category=cars] [--min-year=1985] [--brands=21,59]
//                         [--max-requests=400] [--reserve=20] [--interval-ms=1300]
//                         [--out=data/fipe] [--cache=.cache/fipe]
//
// Phases: the listing (every version and year, cheap) always comes first;
// prices start only once the listing is complete and then go 0 km first,
// newest years next. --phase=listing stops after the listing. --offline makes
// no requests at all and only rewrites the snapshot from the cache.
//
// Responses are cached in .cache/fipe, so running it again (e.g. the next day,
// after the daily limit resets) resumes where it stopped. The snapshot is
// always rebuilt from the whole cache, so it covers every run so far.
//
// Keys come from FIPE_TOKEN and FIPE_TOKEN1, FIPE_TOKEN2… in the environment
// or .env. They are used in that order: when one reaches its daily limit the
// next takes over, and anonymous access (500/day) is the last resort.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { assembleSnapshot, crawlListing, crawlPrices, oldestFipeYear } from "./crawl.ts";
import type { CrawlOptions, FipeCategory } from "./crawl.ts";
import { createFipeClient, fipeKeysFromEnv } from "./fipe-client.ts";

interface FipeReference {
  code: string;
  month: string;
}

const { values } = parseArgs({
  options: {
    phase: { type: "string", default: "all" },
    offline: { type: "boolean", default: false },
    reference: { type: "string" },
    category: { type: "string", default: "cars" },
    "min-year": { type: "string", default: String(oldestFipeYear) },
    brands: { type: "string" },
    "max-requests": { type: "string" },
    reserve: { type: "string", default: "20" },
    "interval-ms": { type: "string", default: "1300" },
    out: { type: "string", default: "data/fipe" },
    cache: { type: "string", default: ".cache/fipe" },
  },
});

const category = values.category as FipeCategory;
if (!["cars", "motorcycles", "trucks"].includes(category)) {
  throw new Error(`Categoria inválida: ${category}`);
}
if (!["all", "listing"].includes(values.phase)) {
  throw new Error(`Fase inválida: ${values.phase} (use all ou listing)`);
}

const keys = fipeKeysFromEnv(process.env);
const client = createFipeClient({
  cacheDir: values.cache,
  keys,
  onKeyChange: (key, reason) => console.log(`${reason}. Usando ${key.label}.`),
  maxRequests: values["max-requests"]
    ? Number(values["max-requests"])
    : undefined,
  reserve: Number(values.reserve),
  minIntervalMs: Number(values["interval-ms"]),
});
const offlineClient = createFipeClient({ cacheDir: values.cache, offline: true });

let reference = values.reference;
let referenceLabel: string | undefined;
if (!reference && values.offline) {
  throw new Error("--offline requer --reference");
}
if (!reference) {
  const references =
    (await client.get<FipeReference[]>("/references", { cache: false })) ?? [];
  reference = references[0]?.code;
  referenceLabel = references[0]?.month;
  if (!reference) throw new Error("Nenhuma referência FIPE disponível");
  console.log(`Referência mais recente: ${referenceLabel} (${reference})`);
}

const options: CrawlOptions = {
  reference,
  category,
  minYear: Number(values["min-year"]),
  brandCodes: values.brands?.split(",").map((code) => code.trim()),
  log: (message) => console.log(message),
};
const startedAt = Date.now();
const failures: { path: string; status: number }[] = [];
let stopReason: string | undefined;

if (!values.offline) {
  console.log(
    keys.length > 1
      ? `Chaves FIPE: ${keys.map((key) => key.label).join(", ")}.`
      : "Sem chave FIPE: limite de 500 requisições por dia.",
  );

  const listing = await crawlListing(client, options);
  failures.push(...listing.failures);
  stopReason = listing.stopReason;
  console.log(
    `Listagem ${listing.complete ? "completa" : "parcial"}: ${listing.vehicles.length} versões-ano`,
  );

  if (listing.complete && values.phase === "all") {
    const prices = await crawlPrices(client, listing.vehicles, options);
    failures.push(...prices.failures);
    stopReason = prices.stopReason;
    console.log(`Preços consultados nesta execução: ${prices.fetched}`);
  }
}

const snapshot = await assembleSnapshot(offlineClient, options);
const referenceMonth =
  snapshot.vehicles.find((vehicle) => vehicle.detail)?.detail?.referenceMonth ??
  referenceLabel ??
  null;

await mkdir(values.out, { recursive: true });
const outFile = join(values.out, `${category}-${reference}.json`);
await writeFile(
  outFile,
  `${JSON.stringify({
    reference,
    referenceMonth,
    category,
    generatedAt: new Date().toISOString(),
    listingComplete: snapshot.listingComplete,
    complete: snapshot.pricesComplete,
    stopReason: stopReason ?? null,
    stats: snapshot.stats,
    failures,
    vehicles: snapshot.vehicles,
  })}\n`,
);

const { requests, remaining, key, keysUsed } = client.stats();
const { stats } = snapshot;
const pricedShare = stats.listed ? Math.round((100 * stats.priced) / stats.listed) : 0;
console.log(
  [
    `${stats.listed} versões-ano de ${stats.brands} marcas em ${outFile}`,
    `${stats.priced} com preço (${pricedShare}%)`,
    `${requests} requisições com ${keysUsed} de ${keys.length} chaves` +
      (remaining === undefined ? "" : `, ${remaining} restantes hoje em ${key}`),
    `${((Date.now() - startedAt) / 1000).toFixed(0)}s`,
    !snapshot.listingComplete
      ? "Listagem incompleta: rode de novo para continuar."
      : snapshot.pricesComplete
        ? "Listagem e preços completos."
        : "Listagem completa; preços continuam nas próximas execuções.",
  ].join(" · "),
);
if (failures.length > 0) {
  console.log(`${failures.length} itens falharam e foram ignorados.`);
}
