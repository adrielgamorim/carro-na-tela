// Downloads the spec pages of the brand sites that publish them as HTML: Kia
// (each model's page, which names the version codes, and its
// /especificacoes), GWM (/specification of each version), Ford
// (/compare-as-versoes/<versão> of each version) and Nissan (each model's
// compare.html). Their robots.txt allow these paths (checked on 31/10/2026).
//
//   npm run fichas:sites
//
// Writes data/fichas/sites.json (committed) and the pages to
// data/fichas/sites (not committed), one request every 2 s.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { writeFileRetrying } from "../write-file.ts";
import { fordPages } from "./ford.ts";
import { gwmPages } from "./gwm.ts";
import { kiaModels } from "./kia.ts";
import { nissanModels } from "./nissan.ts";

const headers = { "user-agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };
const delayMs = 2000;
const dir = "data/fichas/sites";

export interface SiteFile {
  brand: "kia" | "gwm" | "ford" | "nissan";
  slug: string;
  /** The spec page and its file in data/fichas/sites. */
  url: string;
  file: string;
  /** Kia's model page, which names the versions. */
  modelFile?: string;
  fetched: string;
}

export interface SitesFile {
  _doc?: string;
  pages: SiteFile[];
}

async function download(url: string, file: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const response = await fetch(url, { headers });
  // GWM answers a missing page with its "Ops! Página não encontrada." and a 200.
  const html = response.ok ? await response.text() : "";
  if (!html || /P[aá]gina n[aã]o encontrada/i.test(html.match(/<title>([^<]*)/)?.[1] ?? "")) {
    console.log(`  ${response.status} ${url}: sem página`);
    return false;
  }
  await writeFileRetrying(join(dir, file), html);
  return true;
}

await mkdir(join(dir, "kia"), { recursive: true });
await mkdir(join(dir, "gwm"), { recursive: true });
await mkdir(join(dir, "ford"), { recursive: true });
await mkdir(join(dir, "nissan"), { recursive: true });
const fetched = new Date().toISOString().slice(0, 10);
const pages: SiteFile[] = [];
for (const model of kiaModels) {
  const url = `https://www.kia.com.br/${model}/especificacoes`;
  const file = `kia/${model}.html`;
  const modelFile = `kia/${model}-modelo.html`;
  if ((await download(url, file)) && (await download(`https://www.kia.com.br/${model}`, modelFile))) {
    pages.push({ brand: "kia", slug: model, url, file, modelFile, fetched });
  }
}
for (const { slug } of gwmPages) {
  const url = `https://www.gwmmotors.com.br/pt/modelos/${slug}/specification`;
  const file = `gwm/${slug}.html`;
  if (await download(url, file)) pages.push({ brand: "gwm", slug, url, file, fetched });
}
for (const { category, path } of fordPages) {
  const url = `https://www.ford.com.br/${category}/${path}.html`;
  const file = `ford/${path.replace("/compare-as-versoes/", "--")}.html`;
  if (await download(url, file)) pages.push({ brand: "ford", slug: path, url, file, fetched });
}
for (const { slug } of nissanModels) {
  const url = `https://www.nissan.com.br/veiculos/modelos/${slug}/compare.html`;
  const file = `nissan/${slug}.html`;
  if (await download(url, file)) pages.push({ brand: "nissan", slug, url, file, fetched });
}

const out: SitesFile = {
  _doc: "Páginas de especificações dos sites da Kia, da GWM, da Ford e da Nissan (npm run fichas:sites), baixadas em data/fichas/sites; lidas por npm run fichas:abertas.",
  pages,
};
await writeFileRetrying("data/fichas/sites.json", `${JSON.stringify(out, null, 1)}\n`);
console.log(`${pages.length} páginas em data/fichas/sites.json`);
