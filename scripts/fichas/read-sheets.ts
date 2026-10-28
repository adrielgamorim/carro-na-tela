// Reads the spec sheet PDFs downloaded by hand from the checklist
// (data/fichas/lista.html) and writes their figures to data/fichas/fichas.json,
// which build:catalog matches to the FIPE versions.
//
//   npm run fichas:ler                         PDFs already in data/fichas/pdf
//   npm run fichas:ler -- --de="C:\Users\…\Downloads"   also moves the sheets found there
//
// The PDFs stay out of git (data/fichas/pdf); only the figures are committed.

import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readPdfLines } from "../inmetro/pdf-lines.ts";
import { linkOfFile, sheetSpecs } from "./sheets.ts";
import type { ReadSheet, ReadSheetsFile, SheetLinksFile } from "./sheets.ts";

const { values } = parseArgs({ options: { de: { type: "string" } } });
const pdfDir = "data/fichas/pdf";
await mkdir(pdfDir, { recursive: true });
const { links } = JSON.parse(await readFile("data/fichas/links.json", "utf8")) as SheetLinksFile;

// Sheets in the downloads folder: their names start with "fichatecnica".
if (values.de) {
  const found = (await readdir(values.de)).filter((name) => /^ficha.*\.pdf$/i.test(name));
  for (const name of found) {
    await copyFile(join(values.de, name), join(pdfDir, name));
    await rm(join(values.de, name));
  }
  console.log(`${found.length} fichas movidas de ${values.de} para ${pdfDir}`);
}

const sheets: ReadSheet[] = [];
const unknown: string[] = [];
for (const file of (await readdir(pdfDir)).filter((name) => name.toLowerCase().endsWith(".pdf")).sort()) {
  const link = linkOfFile(file, links);
  if (!link) {
    unknown.push(file);
    continue;
  }
  const lines = (await readPdfLines(join(pdfDir, file)))
    .sort((a, b) => a.page - b.page || b.y - a.y)
    .map((line) => [...line.cells].sort((a, b) => a.center - b.center).map((cell) => cell.text).join(" "));
  sheets.push({
    id: link.id,
    brand: link.brand,
    pageTitle: link.pageTitle,
    title: link.title,
    modelYear: link.modelYear,
    page: link.page,
    url: link.url,
    file,
    specs: sheetSpecs(lines),
  });
}

const out: ReadSheetsFile = {
  _doc: "Números das fichas técnicas da Stellantis (npm run fichas:ler), lidos dos PDFs em data/fichas/pdf.",
  sheets: sheets.sort((a, b) => a.brand.localeCompare(b.brand) || a.title.localeCompare(b.title) || (a.modelYear ?? 0) - (b.modelYear ?? 0)),
};
await writeFile("data/fichas/fichas.json", `${JSON.stringify(out, null, 1)}\n`);
console.log(`${sheets.length} fichas lidas em data/fichas/fichas.json`);
if (unknown.length) console.log(`Sem link correspondente (rode npm run fichas:links): ${unknown.join(", ")}`);
