// Downloads the owner's manuals Renault publishes on renault.com.br (a page
// per model, /manuais/<modelo>.html, listed in the sitemap; the PDFs on
// cdn.group.renault.com). Their robots.txt allow these paths (checked on
// 31/10/2026). Only the owner's manuals of combustion models: not the radio's,
// the warranty's or the electric ones'.
//
//   npm run fichas:manuais
//
// Writes data/fichas/manuais.json (committed) and the PDFs to
// data/fichas/manuais (not committed), one request every 2 s. Read by npm
// run fichas:abertas.

import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { writeFileRetrying } from "../write-file.ts";

const headers = { "user-agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };
const delayMs = 2000;
const dir = "data/fichas/manuais";

export interface ManualLink {
  brand: "renault";
  /** The FIPE line. */
  line: string;
  years: [number, number];
  url: string;
  /** The model's page that lists it. */
  page: string;
  /** In data/fichas/manuais. */
  file: string;
}

export interface ManualsFile {
  _doc?: string;
  manuals: ManualLink[];
}

// The radio's, the media system's, the warranty's, quick guides, the electric models'.
const notAnOwnersManual =
  /r[aá]dio|m[ií]dia|multimidia|mutimidia|garantia|seguranca|guia|catalog|complementar|navega|recompra|assist|easy|link|\bnx-?\d|e-tech|eletric|electrique|x61|zoe|product-plans/i;

const folderLines: [RegExp, string][] = [
  [/manuais-duster-oroch\//, "Duster Oroch"],
  [/duster-oroch/i, "Duster Oroch"],
  [/manuais-sandero\//, "Sandero"],
  [/manual-logan\//, "Logan"],
  [/manuais-duster\//, "Duster"],
  [/manuais-captur\//, "Captur"],
  [/manuais-clio\//, "Clio"],
  [/manuais-fluence\//, "Fluence"],
  [/manuais-kangoo\//, "Kangoo"],
  [/manuais-kwid\//, "Kwid"],
  [/manuais-master\//, "Master"],
];
const pageLines: Record<string, string> = {
  boreal: "Boreal",
  captur: "Captur",
  clio: "Clio",
  duster: "Duster",
  fluence: "Fluence",
  kangoo: "Kangoo",
  kardian: "Kardian",
  kwid: "Kwid",
  logan: "Logan",
  master: "Master",
  oroch: "Oroch",
  sandero: "Sandero",
  "sandero-rs": "Sandero",
  stepway: "Stepway",
};

/** The FIPE line of a manual: its folder's model ("manuais-duster/2016"), else its page's; none for an electric model's page. */
export function manualLine(path: string, page: string): string | undefined {
  return folderLines.find(([pattern]) => pattern.test(path))?.[1] ?? pageLines[page];
}

/**
 * The model years of a manual, from its path: a year in its name
 * ("…-2018.pdf", "…-2020-2021.pdf"), its model's folder ("manuais-sandero/2015/"),
 * or the folder of the month it was published ("2023/manuais/agosto/"), that
 * year's model or the next's.
 */
export function manualYears(path: string): [number, number] | undefined {
  const name = path.split("/").at(-1)!;
  const span = name.match(/(20\d\d)-(20\d\d)\b/);
  if (span) return [Number(span[1]), Number(span[2])];
  const named = name.match(/(?<!\d)(20[012]\d)(?!\d)/);
  if (named) return [Number(named[1]), Number(named[1])];
  const model = path.match(/(?:manuais-[a-z-]+|manual-logan|manuais_)\/?(20\d\d)\//);
  if (model) return [Number(model[1]), Number(model[1])];
  const published = path.match(/(?:editorial\/|manuais\/)(20\d\d)\//) ?? path.match(/manuais-propietario(\d\d)\//);
  if (published) {
    const year = Number(published[1]!.length === 2 ? `20${published[1]}` : published[1]);
    return [year, year + 1];
  }
  return undefined;
}

async function get(url: string): Promise<Response | undefined> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return fetch(url, { headers }).catch(() => undefined);
}

if (import.meta.main) {
  const sitemap = await (await get("https://www.renault.com.br/sitemap.xml"))?.text();
  const pages = [...new Set([...(sitemap ?? "").matchAll(/<loc>(https:\/\/www\.renault\.com\.br\/manuais\/([a-z0-9-]+)\.html)<\/loc>/g)].map((match) => match[1]!))];
  const manuals: ManualLink[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const slug = page.match(/manuais\/([a-z0-9-]+)\.html/)![1]!;
    const html = (await (await get(page))?.text()) ?? "";
    const links = [...html.matchAll(/(?:https:\/\/cdn\.group\.renault\.com)?(\/ren\/br\/[^"' ]+?\.pdf)/g)].map((match) => `https://cdn.group.renault.com${match[1]}`);
    for (const url of new Set(links)) {
      const path = url.replace("https://cdn.group.renault.com/ren/br/renault-new-cars/", "");
      const line = manualLine(path, slug);
      const years = manualYears(path);
      if (notAnOwnersManual.test(path) || !line || !years || seen.has(`${line}|${url}`)) continue;
      seen.add(`${line}|${url}`);
      manuals.push({ brand: "renault", line, years, url, page, file: `renault/${path.replace(/^editorial\//, "").replace(/[^\w.-]+/g, "_")}` });
    }
  }
  await mkdir(join(dir, "renault"), { recursive: true });
  let downloaded = 0;
  for (const manual of [...new Map(manuals.map((item) => [item.file, item])).values()]) {
    if (await stat(join(dir, manual.file)).catch(() => undefined)) continue;
    const response = await get(manual.url);
    if (!response?.ok) {
      console.log(`  ${response?.status ?? "sem resposta"} ${manual.url}`);
      continue;
    }
    await writeFileRetrying(join(dir, manual.file), Buffer.from(await response.arrayBuffer()));
    downloaded++;
    if (downloaded % 10 === 0) console.log(`  ${downloaded} baixados`);
  }
  const out: ManualsFile = {
    _doc: "Manuais do proprietário da Renault (npm run fichas:manuais), baixados em data/fichas/manuais; lidos por npm run fichas:abertas.",
    manuals,
  };
  await writeFileRetrying("data/fichas/manuais.json", `${JSON.stringify(out, null, 1)}\n`);
  console.log(`${manuals.length} manuais de ${pages.length} páginas em data/fichas/manuais.json (${downloaded} baixados agora)`);
}
