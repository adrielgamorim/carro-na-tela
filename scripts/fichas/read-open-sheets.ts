// Reads the spec sheets downloaded from the open press rooms (npm run
// fichas:vw and fichas:renault) and writes their figures to
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
import { hyundaiCatalog } from "./hyundai.ts";
import type { WaybackFile } from "./fetch-wayback.ts";

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
  const { sheet, list } = hyundaiCatalog(lines, { file, url: archived });
  const key = (sheet ?? list) && `${(sheet ?? list)!.title}`;
  if (!key || hyundaiSeen.has(key)) continue;
  hyundaiSeen.add(key);
  if (sheet) sheets.push(sheet);
  if (list) equipment.push(list);
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
  _doc: "Números das fichas técnicas da Volkswagen, da Renault, da Toyota e da Hyundai (npm run fichas:abertas), lidos dos arquivos de data/fichas/vw, renault, toyota e hyundai e de data/fichas/toyota.json.",
  sheets: unique.sort((a, b) => a.brand.localeCompare(b.brand) || a.line.localeCompare(b.line) || a.years[0] - b.years[0] || a.title.localeCompare(b.title)),
};
await writeFileRetrying("data/fichas/fichas-abertas.json", `${JSON.stringify(out, null, 1)}\n`);
console.log(`${unique.length} fichas em data/fichas/fichas-abertas.json`);

const equipmentOut: EquipmentFile = {
  _doc: "Equipamentos de série por versão da Renault, da Toyota e da Hyundai (npm run fichas:abertas), das listas em data/fichas/renault, toyota e hyundai e de data/fichas/toyota.json.",
  lists: equipment,
};
await writeFileRetrying("data/fichas/equipamentos.json", `${JSON.stringify(equipmentOut, null, 1)}\n`);
console.log(`${equipment.length} listas de equipamentos (versões) em data/fichas/equipamentos.json`);
if (skipped.length) console.log(`Sem números: ${skipped.join("; ")}`);
