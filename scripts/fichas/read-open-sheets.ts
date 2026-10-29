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

// Two files of the same sheets (Renault lists the Z.E. sheet twice): once.
const seen = new Set<string>();
const unique = sheets.filter((sheet) => {
  const key = `${sheet.brand}|${sheet.title}|${JSON.stringify(sheet.specs)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const out: OpenSheetsFile = {
  _doc: "Números das fichas técnicas da Volkswagen e da Renault (npm run fichas:abertas), lidos dos arquivos de data/fichas/vw e data/fichas/renault.",
  sheets: unique.sort((a, b) => a.brand.localeCompare(b.brand) || a.line.localeCompare(b.line) || a.years[0] - b.years[0] || a.title.localeCompare(b.title)),
};
await writeFileRetrying("data/fichas/fichas-abertas.json", `${JSON.stringify(out, null, 1)}\n`);
console.log(`${unique.length} fichas em data/fichas/fichas-abertas.json`);

const equipmentOut: EquipmentFile = {
  _doc: "Equipamentos de série por versão da Renault (npm run fichas:abertas), das listas em data/fichas/renault.",
  lists: equipment,
};
await writeFileRetrying("data/fichas/equipamentos.json", `${JSON.stringify(equipmentOut, null, 1)}\n`);
console.log(`${equipment.length} listas de equipamentos (versões) em data/fichas/equipamentos.json`);
if (skipped.length) console.log(`Sem números: ${skipped.join("; ")}`);
