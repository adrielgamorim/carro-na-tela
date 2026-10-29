// Insurance figures per FIPE version from SUSEP's AUTOSEG (open data on car
// insurance, a file per half year): for each FIPE code, the premium as a
// share of the insured value and the thefts per thousand vehicle-years; for
// each state, how its premiums compare with the country's.
//
//   npm run fetch:seguro -- [--periodo=2021A]
//
// The newest file is from 2021, so the app applies the rate to today's FIPE
// price rather than showing 2021's premiums. The zip (~535 MB) is kept in
// .cache/autoseg; only its CASCO table by region is read, as a stream.
// Writes data/seguro/autoseg.json.

import { createReadStream } from "node:fs";
import { mkdir, open, stat } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { createInflateRaw } from "node:zlib";
import { writeFileRetrying } from "../write-file.ts";
import { aggregateAutoseg, autosegRow } from "./autoseg.ts";

const { values } = parseArgs({ options: { periodo: { type: "string", default: "2021A" } } });
const period = values.periodo!;
const cacheDir = ".cache/autoseg";
const zipPath = join(cacheDir, `Autoseg${period}.zip`);
const source = `https://www2.susep.gov.br/redarq.asp?arq=Autoseg${period}%2ezip`;
const headers = { "user-agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };

await mkdir(cacheDir, { recursive: true });
if (!(await stat(zipPath).catch(() => undefined))) {
  console.log(`Baixando ${source} (~500 MB)…`);
  const response = await fetch(source, { headers });
  if (!response.ok) throw new Error(`${response.status} em ${source}`);
  await writeFileRetrying(zipPath, new Uint8Array(await response.arrayBuffer()));
}

/** Where a zip entry's compressed bytes are, from the central directory at the end of the file. */
async function entry(path: string, name: string) {
  const file = await open(path, "r");
  try {
    const { size } = await file.stat();
    const tail = Buffer.alloc(Math.min(size, 66_000));
    await file.read(tail, 0, tail.length, size - tail.length);
    const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0) throw new Error("zip sem diretório central");
    const count = tail.readUInt16LE(end + 10);
    const directorySize = tail.readUInt32LE(end + 12);
    const directory = Buffer.alloc(directorySize);
    await file.read(directory, 0, directorySize, tail.readUInt32LE(end + 16));
    for (let offset = 0, i = 0; i < count; i++) {
      const nameLength = directory.readUInt16LE(offset + 28);
      const entryName = directory.toString("latin1", offset + 46, offset + 46 + nameLength);
      if (entryName === name) {
        const compressed = directory.readUInt32LE(offset + 20);
        const local = directory.readUInt32LE(offset + 42);
        const header = Buffer.alloc(30);
        await file.read(header, 0, 30, local);
        const start = local + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
        return { start, end: start + compressed - 1, method: directory.readUInt16LE(offset + 10) };
      }
      offset += 46 + nameLength + directory.readUInt16LE(offset + 30) + directory.readUInt16LE(offset + 32);
    }
    throw new Error(`${name} não está no zip`);
  } finally {
    await file.close();
  }
}

const table = await entry(zipPath, "arq_casco_comp.csv");
if (table.method !== 8) throw new Error("arq_casco_comp.csv sem compressão deflate");
const stream = createReadStream(zipPath, { start: table.start, end: table.end }).pipe(createInflateRaw());
stream.setEncoding("latin1");
const rows = (async function* () {
  let header = true;
  for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
    if (header) {
      header = false;
      continue;
    }
    const row = autosegRow(line);
    if (row) yield row;
  }
})();

const result = await aggregateAutoseg(rows, { period, source });
await mkdir("data/seguro", { recursive: true });
await writeFileRetrying("data/seguro/autoseg.json", `${JSON.stringify(result)}\n`);
console.log(
  `${Object.keys(result.models).length} versões FIPE com seguro em data/seguro/autoseg.json ` +
    `(taxa nacional ${(result.nationalRate * 100).toFixed(2)}% ao ano, ${result.nationalTheft.toFixed(1)} roubos/furtos por mil)`,
);
