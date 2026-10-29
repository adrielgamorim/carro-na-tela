// Downloads spec sheets and equipment lists that a carmaker removed from its
// site but the Wayback Machine (web.archive.org) kept: its CDX API lists the
// PDFs saved under a site, and each is fetched from the archive as saved.
//
//   npm run fichas:wayback -- --site=toyotacomunica.com.br/wp-content/uploads --pasta=toyota
//
// Only names that look like a sheet or a list ("ficha", "técnica",
// "equipamentos"); the newest copy of each. One request every 3 s, which the
// archive asks of tools. Writes data/fichas/<pasta>/ (not committed) and
// data/fichas/<pasta>-wayback.json (committed), the list of what came from where.

import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { writeFileRetrying } from "../write-file.ts";

const { values } = parseArgs({ options: { site: { type: "string" }, pasta: { type: "string" } } });
if (!values.site || !values.pasta) throw new Error("use --site=<domínio/caminho> --pasta=<nome>");
const headers = { "user-agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };
const delayMs = 3000;
const dir = join("data/fichas", values.pasta);

export interface WaybackFile {
  /** The file's address on the carmaker's site. */
  original: string;
  /** When the archive saved the copy used (YYYYMMDDhhmmss). */
  timestamp: string;
  /** Its name in data/fichas/<pasta>. */
  file: string;
  /** The archived copy, for the source link. */
  archived: string;
}

const wanted = /ficha|t[eé]cnica|tecnica|equipamento/i;

/** "…/2020/10/Ficha-Tecnica-Hilux-2024-1.pdf" → "2020-10-ficha-tecnica-hilux-2024-1.pdf" (two months may share a name). */
export function waybackFileName(original: string): string {
  const path = decodeURIComponent(original.split("/uploads/")[1] ?? original.split("/").pop() ?? "ficha.pdf");
  return path
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\.pdf$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .concat(".pdf");
}

async function fetchRetrying(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    const response = await fetch(url, { headers }).catch(() => undefined);
    if (response?.ok) return response;
    if (attempt >= 4) throw new Error(`${response?.status ?? "sem resposta"} em ${url}`);
  }
}

const listing = await (
  await fetchRetrying(
    `https://web.archive.org/cdx/search/cdx?url=${values.site}/*&filter=mimetype:application/pdf&filter=statuscode:200&fl=timestamp,original`,
  )
).text();
if (!/^\d{14} /.test(listing)) throw new Error("o arquivo não respondeu com a lista (fora do ar?)");

// The newest copy of each file.
const newest = new Map<string, string>();
for (const line of listing.split("\n")) {
  const [timestamp, original] = line.trim().split(" ");
  if (!timestamp || !original || !wanted.test(decodeURIComponent(original))) continue;
  const key = original.replace(/^https?:\/\/(www\.)?/, "");
  if ((newest.get(key)?.split(" ")[0] ?? "") < timestamp) newest.set(key, `${timestamp} ${original}`);
}

await mkdir(dir, { recursive: true });
const have = new Set(await readdir(dir));
const files: WaybackFile[] = [];
let downloaded = 0;
for (const entry of newest.values()) {
  const [timestamp, original] = entry.split(" ") as [string, string];
  const file = waybackFileName(original);
  const archived = `https://web.archive.org/web/${timestamp}/${original}`;
  files.push({ original, timestamp, file, archived });
  if (have.has(file)) continue;
  // "id_": the file as saved, without the archive's banner.
  const response = await fetchRetrying(`https://web.archive.org/web/${timestamp}id_/${original}`).catch((error: unknown) => {
    console.log(`  ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  });
  if (!response) continue;
  await writeFileRetrying(join(dir, file), new Uint8Array(await response.arrayBuffer()));
  downloaded++;
  console.log(`  ${file}`);
}

files.sort((a, b) => a.file.localeCompare(b.file));
await writeFileRetrying(
  join("data/fichas", `${values.pasta}-wayback.json`),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), site: values.site, files }, null, 1)}\n`,
);
console.log(`${files.length} fichas e listas no arquivo; ${downloaded} baixadas agora em ${dir}`);
