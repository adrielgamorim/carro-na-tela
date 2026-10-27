// Downloads the WMI list (chassis manufacturer codes) from the English
// Wikipedia, matches the makers to FIPE car brands and writes
// public/catalog/wmi.json, used by the chassis search in the catalog.
//
//   npm run fetch:wmi -- [--out=public/catalog]
//
// FIPE brands come from the catalog index and the crawler cache. The list
// changes rarely; run it again after new brands enter the catalog.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { WmiFile, WmiMaker } from "../../src/catalog/vin.ts";
import { createBrandMatcher, parseCountryRanges, parseWmiRows } from "./wmi.ts";

const { values } = parseArgs({
  options: { out: { type: "string", default: "public/catalog" } },
});

const article = "https://en.wikipedia.org/wiki/Vehicle_identification_number";
const response = await fetch(
  "https://en.wikipedia.org/w/index.php?title=Vehicle_identification_number&action=raw",
  { headers: { "User-Agent": "carro-na-tela/1.0 (catalogo FIPE local)" } },
);
if (!response.ok) throw new Error(`Wikipedia respondeu ${response.status}`);
const wikitext = await response.text();

async function readJson<T>(file: string): Promise<T | null> {
  return readFile(file, "utf8").then((text) => JSON.parse(text) as T, () => null);
}

const brands = new Set<string>();
const index = await readJson<{ brands: { name: string }[] }>("public/catalog/index.json");
for (const brand of index?.brands ?? []) brands.add(brand.name);
for (const reference of await readdir(".cache/fipe").catch(() => [])) {
  const cached = await readJson<{ body: { name: string }[] }>(
    join(".cache/fipe", reference, "cars", "brands.json"),
  );
  for (const brand of cached?.body ?? []) brands.add(brand.name);
}
if (!brands.size) throw new Error("Nenhuma marca FIPE encontrada: rode npm run build:catalog antes");

const portuguese = (await readJson<Record<string, string>>("scripts/vin/countries-pt.json")) ?? {};
const translate = (country: string) => portuguese[country] ?? country;
const matchBrands = createBrandMatcher([...brands]);

const wmi: Record<string, WmiMaker[]> = {};
let matched = 0;
for (const row of parseWmiRows(wikitext)) {
  const maker: WmiMaker = { m: row.maker };
  if (row.country) maker.c = translate(row.country);
  const found = matchBrands(row.maker);
  if (found.length) {
    maker.b = found;
    matched++;
  }
  for (const code of row.codes) (wmi[code] ??= []).push(maker);
}
const countries = parseCountryRanges(wikitext).map(
  ([from, to, country]): [string, string, string] => [from, to, translate(country)],
);
const untranslated = new Set(
  [...countries.map(([, , country]) => country), ...Object.values(wmi).flat().map((maker) => maker.c)]
    .filter((country): country is string => !!country && !Object.values(portuguese).includes(country)),
);

const file: WmiFile = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: article,
  countries,
  wmi,
};
await mkdir(values.out, { recursive: true });
const outFile = join(values.out, "wmi.json");
await writeFile(outFile, `${JSON.stringify(file)}\n`);
console.log(
  `${outFile}: ${Object.keys(wmi).length} WMIs, ${matched} fabricantes casados com ${brands.size} marcas FIPE, ${countries.length} faixas de país`,
);
if (untranslated.size) {
  console.log(`Países sem tradução (scripts/vin/countries-pt.json): ${[...untranslated].join(", ")}`);
}
