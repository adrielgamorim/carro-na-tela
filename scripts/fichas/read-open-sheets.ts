// Reads the spec sheets downloaded from the open press rooms (npm run
// fichas:vw, fichas:renault, fichas:wayback and fichas:sites) and writes their figures to
// data/fichas/fichas-abertas.json, and Renault's equipment lists to
// data/fichas/equipamentos.json, which build:catalog matches to the FIPE
// versions.
//
//   npm run fichas:abertas

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readPdfLines } from "../inmetro/pdf-lines.ts";
import { writeFileRetrying } from "../write-file.ts";
import { renaultSheets, vwSheet } from "./open-sheets.ts";
import type { OpenSheet, OpenSheetsFile, RenaultLink, VwLink } from "./open-sheets.ts";
import { readXlsxFile } from "./xlsx.ts";
import { renaultEquipment } from "./equipment.ts";
import type { EquipmentFile, EquipmentList } from "./equipment.ts";
import { toyotaEquipment, toyotaSheets } from "./toyota.ts";
import { hyundaiCatalog, hyundaiTable } from "./hyundai.ts";
import { hondaBrochure } from "./honda.ts";
import { brochureFile, renaultBrochureEquipment } from "./renault-brochure.ts";
import type { WaybackFile } from "./fetch-wayback.ts";
import type { SitesFile } from "./fetch-sites.ts";
import { kiaNames, kiaSpecPage } from "./kia.ts";
import { gwmPages, gwmSpecPage } from "./gwm.ts";

const sheets: OpenSheet[] = [];
const equipment: EquipmentList[] = [];
const skipped: string[] = [];

const vw = await readFile("data/fichas/vw-links.json", "utf8")
  .then((text) => (JSON.parse(text) as { links: VwLink[] }).links)
  .catch(() => [] as VwLink[]);
for (const link of vw) {
  if (!link.file) continue;
  const lines = await readPdfLines(join("data/fichas/vw", link.file))
    .then((found) =>
      found
        .sort((a, b) => a.page - b.page || b.y - a.y)
        .map((line) => [...line.cells].sort((a, b) => a.center - b.center).map((cell) => cell.text).join(" ").trim())
        .filter(Boolean),
    )
    .catch(() => undefined);
  const sheet = lines && vwSheet(lines, link);
  if (sheet) sheets.push(sheet);
  else skipped.push(`VW ${link.title} (${link.file})`);
}

const renault = await readFile("data/fichas/renault-links.json", "utf8")
  .then((text) => (JSON.parse(text) as { links: RenaultLink[] }).links)
  .catch(() => [] as RenaultLink[]);
for (const link of renault) {
  if (!link.file) continue;
  const spreadsheet = await readXlsxFile(join("data/fichas/renault", link.file)).catch(() => undefined);
  const found = spreadsheet ? renaultSheets(spreadsheet.rows, link, spreadsheet.modified) : [];
  if (found.length) {
    sheets.push(...found);
    continue;
  }
  // Some "spec sheets" are the versions' equipment lists; the file's own date
  // first, since the one in its name is when the press room moved it.
  const named = link.file.match(/(20\d\d)-\d\d-\d\d/)?.[1];
  const saved = spreadsheet?.modified ?? (named ? new Date(`${named}-07-01`) : undefined);
  const lists = spreadsheet ? renaultEquipment(spreadsheet.rows, link, saved) : [];
  if (lists.length) equipment.push(...lists);
  else skipped.push(`Renault ${link.vehicle} (${link.file}, ${spreadsheet ? "sem números" : "formato não lido"})`);
}

// Renault's brochures: the equipment of the lines and years the spreadsheets do not list (Duster, Kwid, Kangoo).
const fromSpreadsheets = [...equipment];
const brochuresRead = new Set<string>();
for (const link of renault) {
  const file = link.brochure && brochureFile(link.brochure);
  if (!link.brochure || !file || brochuresRead.has(file)) continue;
  brochuresRead.add(file);
  const lines = await readPdfLines(join("data/fichas/renault/folhetos", file)).catch(() => undefined);
  if (!lines) continue;
  const lists = renaultBrochureEquipment(lines, { vehicle: link.vehicle, brochure: link.brochure, page: link.page });
  equipment.push(
    ...lists.filter(
      (list) =>
        !fromSpreadsheets.some(
          (other) => other.line === list.line && other.years[0] <= list.years[1] && list.years[0] <= other.years[1],
        ),
    ),
  );
}

// Toyota's, from the Wayback Machine (npm run fichas:wayback): of each line and
// model year, only the newest file's (the press room replaced sheets several times).
const toyotaFiles = await readFile("data/fichas/toyota-wayback.json", "utf8")
  .then((text) => (JSON.parse(text) as { files: WaybackFile[] }).files)
  .catch(() => [] as WaybackFile[]);
const toyotaSheetsRead: OpenSheet[] = [];
const toyotaLists: EquipmentList[] = [];
for (const { file, archived } of toyotaFiles) {
  const lines = await readPdfLines(join("data/fichas/toyota", file)).catch(() => undefined);
  if (!lines) continue;
  const source = { file, url: archived };
  const found = toyotaSheets(lines, source);
  const lists = toyotaEquipment(lines, source);
  toyotaSheetsRead.push(...found);
  toyotaLists.push(...lists);
  if (!found.length && !lists.length) skipped.push(`Toyota ${file}`);
}
// The file names start with the upload month ("2024-08-…"), so the greatest is the newest.
const newestOnly = <T extends { line: string; years: [number, number]; file: string }>(items: T[]) => {
  const newest = new Map<string, string>();
  for (const item of items) {
    const key = `${item.line}|${item.years[0]}`;
    if ((newest.get(key) ?? "") < item.file) newest.set(key, item.file);
  }
  return items.filter((item) => newest.get(`${item.line}|${item.years[0]}`) === item.file);
};
const toyotaNewest = newestOnly(toyotaSheetsRead);
sheets.push(...toyotaNewest);
// A list says nothing of the engine; the spec sheet of the same line, year and trim does
// (so the GR Corolla 1.6 turbo does not take the Corolla GR-S's list).
for (const list of newestOnly(toyotaLists)) {
  const sheet = toyotaNewest.find(
    (item) => item.line === list.line && item.years[0] === list.years[0] && item.trims.join() === list.trims.join(),
  );
  equipment.push(
    sheet
      ? {
          ...list,
          ...(sheet.engineLiters !== undefined && { engineLiters: sheet.engineLiters }),
          ...(sheet.turbo !== undefined && { turbo: sheet.turbo }),
          ...(sheet.transmission && !list.transmission && { transmission: sheet.transmission }),
          ...(sheet.cab && { cab: sheet.cab }),
          ...(sheet.onlyNamed && { onlyNamed: true }),
        }
      : list,
  );
}

// Hyundai's catalogs, from the Wayback Machine (npm run fichas:wayback): a version
// each; of the same title and year, one (the press room kept several copies).
const hyundaiFiles = await readFile("data/fichas/hyundai-wayback.json", "utf8")
  .then((text) => (JSON.parse(text) as { files: WaybackFile[] }).files)
  .catch(() => [] as WaybackFile[]);
const hyundaiSeen = new Set<string>();
for (const { file, archived } of hyundaiFiles) {
  const lines = await readPdfLines(join("data/fichas/hyundai", file)).catch(() => undefined);
  if (!lines) {
    skipped.push(`Hyundai ${file} (PDF danificado no arquivo)`);
    continue;
  }
  // The Creta 25/26's equipment, every version in one table.
  if (file.startsWith("ficha-tecnica-equipamentos-")) {
    equipment.push(...hyundaiTable(lines, { file, url: archived }));
    continue;
  }
  const { sheet, list } = hyundaiCatalog(lines, { file, url: archived });
  const key = (sheet ?? list) && `${(sheet ?? list)!.title}`;
  if (!key || hyundaiSeen.has(key)) continue;
  hyundaiSeen.add(key);
  if (sheet) sheets.push(sheet);
  if (list) equipment.push(list);
}

// Honda's brochures, from the Wayback Machine (npm run fichas:wayback): a table of every version;
// of the same title (the site kept copies of a brochure), the first.
const hondaFiles = await readFile("data/fichas/honda-wayback.json", "utf8")
  .then((text) => (JSON.parse(text) as { files: WaybackFile[] }).files)
  .catch(() => [] as WaybackFile[]);
const hondaSeen = new Set<string>();
for (const { file, archived } of hondaFiles) {
  if (/acessorios|honda-store|folheto-cb|crf-|500cc|650cc|ez6500/.test(file)) continue;
  const lines = await readPdfLines(join("data/fichas/honda", file)).catch(() => undefined);
  if (!lines) continue;
  const { sheets: found, lists } = hondaBrochure(lines, { file, url: archived });
  sheets.push(...found.filter((sheet) => !hondaSeen.has(`s|${sheet.title}`) && hondaSeen.add(`s|${sheet.title}`)));
  equipment.push(...lists.filter((list) => !hondaSeen.has(`l|${list.title}`) && hondaSeen.add(`l|${list.title}`)));
}

// Kia's and GWM's spec pages (npm run fichas:sites): the versions on sale when they were downloaded.
const sitePages = await readFile("data/fichas/sites.json", "utf8")
  .then((text) => (JSON.parse(text) as SitesFile).pages)
  .catch(() => [] as SitesFile["pages"]);
for (const site of sitePages) {
  const html = await readFile(join("data/fichas/sites", site.file), "utf8").catch(() => undefined);
  if (!html) continue;
  const source = { url: site.url, file: site.file, fetched: site.fetched };
  if (site.brand === "kia") {
    const model = site.modelFile && (await readFile(join("data/fichas/sites", site.modelFile), "utf8").catch(() => ""));
    const found = kiaSpecPage(html, kiaNames(model || ""), source);
    sheets.push(...found.sheets);
    equipment.push(...found.lists);
    if (!found.sheets.length) skipped.push(`Kia ${site.slug}`);
    continue;
  }
  const page = gwmPages.find((item) => item.slug === site.slug);
  const found = page && gwmSpecPage(html, page, source);
  if (found?.sheet) sheets.push(found.sheet);
  else skipped.push(`GWM ${site.slug}`);
  if (found?.list) equipment.push(found.list);
}

// What the reader cannot get from Toyota's files, transcribed by hand (the Camry 2018 list has no marks).
const toyotaByHand = await readFile("data/fichas/toyota.json", "utf8")
  .then((text) => JSON.parse(text) as { sheets: OpenSheet[]; equipment: EquipmentList[] })
  .catch(() => ({ sheets: [], equipment: [] }));
sheets.push(...toyotaByHand.sheets);
equipment.push(...toyotaByHand.equipment);

// Two files of the same sheets (Renault lists the Z.E. sheet twice): once.
const seen = new Set<string>();
const unique = sheets.filter((sheet) => {
  const key = `${sheet.brand}|${sheet.title}|${JSON.stringify(sheet.specs)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const out: OpenSheetsFile = {
  _doc: "Números das fichas técnicas da Volkswagen, da Renault, da Toyota, da Hyundai, da Honda, da Kia e da GWM (npm run fichas:abertas), lidos dos arquivos de data/fichas/vw, renault, toyota, hyundai, honda e sites e de data/fichas/toyota.json.",
  sheets: unique.sort((a, b) => a.brand.localeCompare(b.brand) || a.line.localeCompare(b.line) || a.years[0] - b.years[0] || a.title.localeCompare(b.title)),
};
await writeFileRetrying("data/fichas/fichas-abertas.json", `${JSON.stringify(out, null, 1)}\n`);
console.log(`${unique.length} fichas em data/fichas/fichas-abertas.json`);

const equipmentOut: EquipmentFile = {
  _doc: "Equipamentos de série por versão da Renault, da Toyota, da Hyundai, da Honda, da Kia e da GWM (npm run fichas:abertas), das listas, folhetos e páginas em data/fichas/renault, toyota, hyundai, honda e sites e de data/fichas/toyota.json.",
  lists: equipment,
};
await writeFileRetrying("data/fichas/equipamentos.json", `${JSON.stringify(equipmentOut, null, 1)}\n`);
console.log(`${equipment.length} listas de equipamentos (versões) em data/fichas/equipamentos.json`);
if (skipped.length) console.log(`Sem números: ${skipped.join("; ")}`);
