// Downloads the newest Senatran fleet by brand/model (Renavam open data,
// dados.transportes.gov.br) and writes the nationwide totals per brand/model
// and year of manufacture to data/frota/frota.json. npm run build:catalog then
// matches them to the catalog's model lines (popularity, and sales estimated
// from the recent years of manufacture).
//
//   npm run fetch:frota -- [--out=data/frota]
//
// The zip (~140 MB) is kept in .cache/frota; a month already downloaded is
// not downloaded again. Senatran publishes one file a month. The month before
// is read once (and its zip deleted) to keep its recent years in `previous`.

import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { writeFileRetrying } from "../write-file.ts";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parseArgs } from "node:util";
import { createInflateRaw } from "node:zlib";
import { createFleetCounter, fleetFileMonth, recentYears } from "./frota.ts";
import type { FleetFile } from "./frota.ts";

const { values } = parseArgs({
  options: { out: { type: "string", default: "data/frota" } },
});

const dataset =
  "https://dados.transportes.gov.br/api/3/action/package_show?id=registro-nacional-de-veiculos-automotores-renavam";
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
};
const cacheDir = ".cache/frota";

const response = await fetch(dataset, { headers });
if (!response.ok) throw new Error(`dados.transportes.gov.br respondeu ${response.status}`);
const { result } = (await response.json()) as { result: { resources: { url: string }[] } };
const files = result.resources
  .map((resource) => ({ url: resource.url, month: fleetFileMonth(resource.url.split("/").pop() ?? "") }))
  .filter((item): item is { url: string; month: NonNullable<typeof item.month> } => item.month !== null)
  .sort((a, b) => b.month.key.localeCompare(a.month.key));
const [newest, before] = files;
if (!newest) throw new Error("Nenhum arquivo de frota por marca/modelo no conjunto de dados");
const reference = newest.month.label;
const referenceYear = Number(newest.month.key.slice(0, 4));

const zipPath = (url: string) => join(cacheDir, url.split("/").pop()!);

async function download(url: string, label: string) {
  const file = zipPath(url);
  if (await stat(file).catch(() => null)) return file;
  console.log(`Baixando a frota de ${label}…`);
  const answer = await fetch(url, { headers });
  if (!answer.ok || !answer.body) throw new Error(`Download respondeu ${answer.status}`);
  await pipeline(Readable.fromWeb(answer.body), createWriteStream(`${file}.part`));
  await rename(`${file}.part`, file);
  return file;
}

/** The zip holds one deflated text file; stream it without unpacking 1.2 GB. */
async function count(zipFile: string) {
  const handle = await open(zipFile);
  const { size } = await handle.stat();
  const tail = Buffer.alloc(Math.min(size, 65_557));
  await handle.read(tail, 0, tail.length, size - tail.length);
  let end = tail.length - 22;
  while (end >= 0 && tail.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error(`${zipFile} não é um zip`);
  const directory = tail.readUInt32LE(end + 16);
  const entry = Buffer.alloc(46);
  await handle.read(entry, 0, 46, directory);
  const compressed = entry.readUInt32LE(20);
  const local = entry.readUInt32LE(42);
  const localHeader = Buffer.alloc(30);
  await handle.read(localHeader, 0, 30, local);
  await handle.close();
  const start = local + 30 + localHeader.readUInt16LE(26) + localHeader.readUInt16LE(28);
  if (entry.readUInt16LE(10) !== 8) throw new Error("Compressão do zip não suportada");

  const counter = createFleetCounter();
  const inflate = createInflateRaw();
  inflate.setEncoding("utf8");
  inflate.on("data", (chunk: string) => counter.push(chunk));
  await pipeline(createReadStream(zipFile, { start, end: start + compressed - 1 }), inflate);
  return counter;
}

await mkdir(cacheDir, { recursive: true });
const zipFile = await download(newest.url, reference);
// Older months are not needed any more (~140 MB each).
for (const name of await readdir(cacheDir)) {
  if (join(cacheDir, name) !== zipFile) await rm(join(cacheDir, name), { force: true });
}
const counter = await count(zipFile);
const models = counter.finish();

// The month before: kept from the last run when it is the same month.
const outFile = join(values.out, "frota.json");
const last = await readFile(outFile, "utf8")
  .then((text) => JSON.parse(text) as FleetFile)
  .catch(() => null);
let previous: FleetFile["previous"];
if (before) {
  const label = before.month.label;
  if (last?.previous?.reference === label) previous = last.previous;
  else if (last?.reference === label) {
    previous = { reference: label, source: last.source, models: recentYears(last.models, referenceYear - 1) };
  } else {
    const file = await download(before.url, label);
    const older = await count(file);
    previous = { reference: label, source: before.url, models: recentYears(older.finish(), referenceYear - 1) };
    await rm(file, { force: true });
  }
}

const output: FleetFile = {
  version: 1,
  generatedAt: new Date().toISOString(),
  reference,
  source: newest.url,
  models,
  states: counter.states(),
  ...(previous && { previous }),
};
await mkdir(values.out, { recursive: true });
await writeFileRetrying(outFile, `${JSON.stringify(output)}\n`);
const total = Object.values(models).reduce(
  (sum, years) => sum + Object.values(years).reduce((a, b) => a + b, 0),
  0,
);
console.log(
  `${outFile}: frota de ${reference}, ${Object.keys(models).length} marcas/modelos, ` +
    `${total.toLocaleString("pt-BR")} veículos (${counter.lines.toLocaleString("pt-BR")} linhas)` +
    (previous ? `; mês anterior: ${previous.reference}` : ""),
);
