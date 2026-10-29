// Lists the spec sheets ("fichas técnicas") of Stellantis Brasil's press room:
// for each brand, the model-year pages its menu links to ("Fiat Pulse MY 2022"),
// and on each page the sheets of its versions. Writes data/fichas/links.json
// and the checklist data/fichas/lista.html (npm run fichas:lista).
//
//   npm run fichas:links
//
// Only the HTML pages, which robots.txt allows, one every 1.5 s with a user
// agent that says who is asking. The PDFs themselves sit behind bot protection:
// they are downloaded by hand, from the checklist, in a normal browser.

import { mkdir } from "node:fs/promises";
import { writeFileRetrying } from "../write-file.ts";
import { decodeEntities } from "../imprensa/press.ts";
import type { SheetLink, SheetLinksFile } from "./sheets.ts";

const site = "https://www.media.stellantis.com";
const brands = ["fiat", "abarth", "jeep", "ram", "peugeot", "citroen", "leapmotor", "chrysler", "dodge"];
const userAgent = "carro-na-tela/1.0 (pesquisa; github.com/adrielgamorim/carro-na-tela)";
const delayMs = 1500;
const notAModel = /\/(press|staff|management|images|videos|search|links|models?)$/;

async function page(path: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const response = await fetch(site + path, { headers: { "user-agent": userAgent } });
  if (response.status === 403 || response.status === 429) throw new Error(`parando: ${response.status} em ${path}`);
  return response.ok ? response.text() : "";
}

/** "Fiat Pulse MY 2022", "fiat-pulse-my27" → 2022, 2027. */
export function modelYearOf(title: string, path: string): number | null {
  const fromTitle = title.match(/\bMY\s*(\d{4}|\d{2})\b/i)?.[1];
  const fromPath = path.match(/my-?(\d{4}|\d{2})\b/)?.[1];
  const year = fromTitle ?? fromPath;
  if (!year) return null;
  return year.length === 2 ? 2000 + Number(year) : Number(year);
}

const links: SheetLink[] = [];
for (const brand of brands) {
  const press = await page(`/br-pt/${brand}/press`);
  const modelPages = [
    ...new Set(
      [...press.matchAll(new RegExp(`href="(/br-pt/${brand}/[a-z0-9-]+)"`, "g"))]
        .map((match) => match[1]!)
        .filter((path) => !notAModel.test(path)),
    ),
  ];
  console.log(`${brand}: ${modelPages.length} páginas de modelo`);
  for (const path of modelPages) {
    const html = await page(path);
    const title = decodeEntities(html.match(/<title>([^<|]+)/)?.[1]?.trim() ?? path);
    const modelYear = modelYearOf(title, path);
    for (const match of html.matchAll(/<a data-title="([^"]*)" href="(\/br-pt\/download-model-document\/(\d+))[^"]*"/g)) {
      links.push({
        brand,
        page: site + path,
        pageTitle: title,
        modelYear,
        id: Number(match[3]),
        title: decodeEntities(match[1]!).trim(),
        url: site + match[2]!,
      });
    }
  }
}

await mkdir("data/fichas", { recursive: true });
const file: SheetLinksFile = { generatedAt: new Date().toISOString(), links };
await writeFileRetrying("data/fichas/links.json", `${JSON.stringify(file, null, 1)}\n`);
console.log(`${links.length} fichas em data/fichas/links.json; rode npm run fichas:lista para a lista`);
