// Downloads the spec sheets ("fichas técnicas") of Volkswagen do Brasil's
// press room (vwnews.com.br): the public menu lists the current models and
// their versions, and each version links its sheet, a PDF on VW's CDN.
//
//   npm run fichas:vw
//
// Writes data/fichas/vw-links.json (committed) and the PDFs to
// data/fichas/vw (not committed), one request every 1.5 s. The full model
// list of the API needs a journalist login, so only the menu's models count.

import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { writeFileRetrying } from "../write-file.ts";

const api = "https://newsroom-cms-br.itd.vw.com.br/v1/api/";
const headers = { "user-agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };
const delayMs = 1500;
const pdfDir = "data/fichas/vw";

export interface VwSheetLink {
  model: string;
  modelId: number;
  versionId: number;
  /** "Polo Highline" */
  title: string;
  /** null when the version has no sheet. */
  pdf: string | null;
  /** The file name in data/fichas/vw, several versions may share one. */
  file: string | null;
  page: string;
  updatedAt: string;
}

interface MenuCar {
  id: number;
  title: string;
  listsub: { id: number; title: string }[];
}

async function json<T>(path: string): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const response = await fetch(api + path, { headers });
  if (!response.ok) throw new Error(`${response.status} em ${path}`);
  return (await response.json()) as T;
}

/** "…/Ficha Técnica Novo Polo 200 TSI.pdf" → "ficha-tecnica-novo-polo-200-tsi.pdf" */
export function pdfFileName(url: string): string {
  const name = decodeURIComponent(url.split("/").pop() ?? "ficha.pdf").replace(/\.pdf$/i, "");
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "ficha"}.pdf`;
}

const { menu } = await json<{ menu: { cars: MenuCar[] } }>("home/json/");
const links: VwSheetLink[] = [];
for (const car of menu.cars) {
  for (const sub of car.listsub) {
    const { version } = await json<{ version?: { title: string; pdfMedia?: string | null; updated_at: string } }>(
      `cars/json/car/${car.id}/version/${sub.id}`,
    );
    const pdf = version?.pdfMedia?.trim() || null;
    links.push({
      model: car.title,
      modelId: car.id,
      versionId: sub.id,
      title: version?.title ?? sub.title,
      pdf,
      file: pdf ? pdfFileName(pdf) : null,
      page: `https://www.vwnews.com.br/cars/version/${car.id}/${sub.id}`,
      updatedAt: version?.updated_at ?? "",
    });
  }
  console.log(`${car.title}: ${car.listsub.length} versões`);
}

await mkdir(pdfDir, { recursive: true });
const have = new Set(await readdir(pdfDir));
let downloaded = 0;
for (const link of links) {
  if (!link.pdf || !link.file || have.has(link.file)) continue;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const response = await fetch(encodeURI(decodeURI(link.pdf)), { headers });
  if (!response.ok) {
    console.log(`  ${link.title}: ${response.status} ao baixar a ficha`);
    continue;
  }
  await writeFileRetrying(join(pdfDir, link.file), new Uint8Array(await response.arrayBuffer()));
  have.add(link.file);
  downloaded++;
}

await writeFileRetrying(
  "data/fichas/vw-links.json",
  `${JSON.stringify({ generatedAt: new Date().toISOString(), links }, null, 1)}\n`,
);
const withPdf = links.filter((link) => link.pdf).length;
console.log(`${links.length} versões, ${withPdf} com ficha; ${downloaded} PDFs novos em ${pdfDir}`);
