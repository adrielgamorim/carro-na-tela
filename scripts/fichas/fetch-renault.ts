// Downloads the spec sheets of Renault do Brasil's press room
// (imprensa.renault.com.br): each vehicle, current or old, has its sheet as
// a spreadsheet, the brochure with the equipment, and its press photos.
//
//   npm run fichas:renault
//
// Writes data/fichas/renault-links.json (committed) and the spreadsheets to
// data/fichas/renault (not committed), one request every 1.5 s. The photos
// are only counted: their use depends on Renault's permission.

import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { writeFileRetrying } from "../write-file.ts";

const site = "https://imprensa.renault.com.br";
const headers = { "user-agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };
const delayMs = 1500;
const sheetDir = "data/fichas/renault";

export interface RenaultSheetLink {
  id: number;
  /** "Captur" */
  vehicle: string;
  category: string;
  old: boolean;
  /** The spreadsheet, null when there is none. */
  excel: string | null;
  /** The file name in data/fichas/renault. */
  file: string | null;
  /** The brochure (PDF), which lists the equipment of the versions. */
  brochure: string | null;
  photos: number;
  page: string;
}

interface VehicleSummary {
  id: number;
  vehicle: string;
  slug: string;
}

async function json<T>(path: string): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const response = await fetch(site + path, { headers });
  if (!response.ok) throw new Error(`${response.status} em ${path}`);
  return (await response.json()) as T;
}

const links: RenaultSheetLink[] = [];
const seen = new Set<number>();
for (const old of [false, true]) {
  const categories = await json<{ title: string; vehicles: VehicleSummary[] }[]>(
    `/api/vehicle/public?filter=true&language=1&modelOld=${old}&divisionCategory=false`,
  );
  for (const { title: category, vehicles } of categories) {
    for (const summary of vehicles) {
      // The English menu repeats vehicles; "FICHA TÉCNICA" is not one.
      if (seen.has(summary.id) || /ficha t[eé]cnica/i.test(summary.vehicle)) continue;
      seen.add(summary.id);
      // Some menu entries have no page of their own ("captur-pt-off").
      const vehicle = await json<{
        excel?: string;
        linkEquipment?: string;
        vehicleModel?: { photos?: { photos?: unknown[] }[] }[];
      }>(`/api/vehicle/public/${summary.slug}?filter=true&slug=${summary.slug}`).catch((error: unknown) => {
        console.log(`  ${summary.vehicle}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });
      if (!vehicle) continue;
      const excel = vehicle.excel?.trim() || null;
      links.push({
        id: summary.id,
        vehicle: summary.vehicle.trim(),
        category,
        old,
        excel,
        file: excel ? `${summary.id}-${summary.slug.replace(/_\d+$/, "")}.xlsx` : null,
        brochure: vehicle.linkEquipment?.trim() || null,
        photos: (vehicle.vehicleModel ?? []).flatMap((model) => model.photos ?? []).flatMap((group) => group.photos ?? [])
          .length,
        page: `${site}/produto/item/${summary.slug}`,
      });
    }
  }
  console.log(`${old ? "modelos antigos" : "modelos atuais"}: ${links.filter((link) => link.old === old).length}`);
}

await mkdir(sheetDir, { recursive: true });
const have = new Set(await readdir(sheetDir));
let downloaded = 0;
for (const link of links) {
  if (!link.excel || !link.file || have.has(link.file)) continue;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  const response = await fetch(link.excel, { headers });
  if (!response.ok) {
    console.log(`  ${link.vehicle}: ${response.status} ao baixar a planilha`);
    continue;
  }
  await writeFileRetrying(join(sheetDir, link.file), new Uint8Array(await response.arrayBuffer()));
  downloaded++;
}

await writeFileRetrying(
  "data/fichas/renault-links.json",
  `${JSON.stringify({ generatedAt: new Date().toISOString(), links }, null, 1)}\n`,
);
const withSheet = links.filter((link) => link.excel).length;
const photos = links.reduce((sum, link) => sum + link.photos, 0);
console.log(`${links.length} veículos, ${withSheet} com planilha; ${downloaded} planilhas novas em ${sheetDir}; ${photos} fotos listadas`);
