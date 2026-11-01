// Drafts the equipment by version of the cached press releases (Stellantis:
// npm run crawl:imprensa; Renault and Volkswagen: npm run crawl:releases)
// and writes the blocks not reviewed yet to
// data/imprensa/equipamentos-candidates.json (not committed). Review them by
// hand into data/imprensa/equipamentos.json: accepted ones go to `lists`
// (fixing line, trims, years, engine and items as needed), wrong ones to
// `rejected`. npm run fichas:abertas then takes the lists in.
//
//   npm run extract:equipamentos

import { readFile } from "node:fs/promises";
import { writeFileRetrying } from "../write-file.ts";
import { getModelFamily } from "../../src/services/fipeParsing.ts";
import type { CatalogIndexFile } from "../../src/catalog/indexFormat.ts";
import { litersOf, transmissionIn, words } from "../fichas/open-sheets.ts";
import type { CachedRelease } from "./crawl-stellantis.ts";
import { plainWords } from "./press.ts";
import { versionBlocks } from "./release-equipment.ts";
import type { ReleaseEquipmentFile, ReleaseList } from "./release-lists.ts";

export type Candidate = ReleaseList & {
  /** The base version as the text names it, when no block of the release matched it. */
  baseName?: string;
  prose: boolean;
  release: { title: string; date: string };
  /** The block as written. */
  text: string[];
};

const roomBrands: Record<string, string[]> = {
  fiat: ["Fiat"], abarth: ["Fiat"], jeep: ["Jeep"], citroen: ["Citroën"], peugeot: ["Peugeot"],
  "psa-archive": ["Peugeot", "Citroën"], ram: ["RAM"], chrysler: ["Chrysler"], dodge: ["Dodge"],
  leapmotor: ["Leapmotor"],
};
const sources = [
  { file: "data/imprensa/stellantis-releases.jsonl", brand: "stellantis" as const },
  { file: "data/imprensa/renault-releases.jsonl", brand: "renault" as const, fipe: ["Renault"] },
  { file: "data/imprensa/vw-releases.jsonl", brand: "vw" as const, fipe: ["VW - VolksWagen"] },
];

const index = JSON.parse(await readFile("public/catalog/index.json", "utf8")) as CatalogIndexFile;
const reviewed = (await readFile("data/imprensa/equipamentos.json", "utf8")
  .then((text) => JSON.parse(text) as ReleaseEquipmentFile)
  .catch(() => ({ lists: [], rejected: [] }))) as ReleaseEquipmentFile;
const known = new Set([...reviewed.lists.map((list) => list.key), ...reviewed.rejected]);

/** FIPE brand → its families, longest first ("Duster Oroch" before "Duster"). */
const families = new Map<string, string[]>();
for (const version of index.versions) {
  const brand = index.brands[version.b]?.name ?? "";
  const family = getModelFamily(version.n);
  if (!families.has(brand)) families.set(brand, []);
  if (!families.get(brand)!.includes(family)) families.get(brand)!.push(family);
}
for (const list of families.values()) list.sort((a, b) => b.length - a.length);

/** The FIPE brand and family a text names as whole words. */
function familyIn(text: string, brands: string[]): { brand: string; family: string } | undefined {
  const plain = plainWords(text);
  for (const brand of brands) {
    for (const family of families.get(brand) ?? []) {
      const key = plainWords(family).trim();
      if (key.length < 2 || !plain.includes(key)) continue;
      // "2008" is a Peugeot; elsewhere a four-digit number is a year.
      if (/^(19|20)\d\d$/.test(key) && brand !== "Peugeot") continue;
      return { brand, family };
    }
  }
  return undefined;
}

// Version words that are not a trim: the engine, gearbox, fuel, "novo".
const notATrim =
  /^(\d.*|novo|nova|new|versao|turbo|tb|tce|sce|tsi|mpi|tdi|flex|diesel|turbodiesel|hibrido|hybrid|mhev|phev|eletrico|at\d?|mt|cvt|edc|aut|automatico|automatica|automatizado|manual|t\d{3}|firefly|gse|multijet|cv|mais|e|de|com|4x2|4x4|awd|cabine|cabina|dupla|simples|estendida|cambio|suv|coupe|thp|hi|torque|evo|portas|lugares|mt\d|os|equipamentos|da|do|anos|gasolina|exclusivo|para|pcd|v\d)$/;

const candidates: Candidate[] = [];
for (const source of sources) {
  const text = await readFile(source.file, "utf8").catch(() => "");
  for (const line of text.split("\n").filter(Boolean)) {
    const release = JSON.parse(line) as CachedRelease;
    if (release.status !== 200 || !release.text) continue;
    const room = release.url.split("/br-pt/")[1]?.split("/")[0] ?? "";
    const brands = source.fipe ?? roomBrands[room] ?? [];
    if (!brands.length) continue;
    const blocks = versionBlocks(release.text).filter((block) => block.items.length >= 3);
    const keys: string[] = [];
    for (const block of blocks) {
      const named = familyIn(block.version, brands) ?? familyIn(release.title, brands);
      const key = `${release.url}#${plainWords(block.version).trim().replace(/\s+/g, "-")}`;
      keys.push(key);
      if (!named || known.has(key)) continue;
      const dateYear = Number(release.date.slice(0, 4));
      // A model year in the header or the title ("Kwid 2027", "linha 2021"), near the date: that one; else the date's and the next.
      const year = [block.version, release.title]
        .flatMap((part) => [...part.matchAll(/\b(20\d\d)\b/g)].map((match) => Number(match[1])))
        .find((value) => value >= dateYear - 1 && value <= dateYear + 1 && String(value) !== named.family);
      const familyWords = new Set([...words(named.family), ...words(named.brand), "jeep", "fiat", "citroen", "peugeot", "ram", "renault", "vw", "volkswagen"]);
      const trims = words(block.version).filter((word) => !familyWords.has(word) && !notATrim.test(word));
      // Stellantis names engines by code: "T270" and "Turbo 270" the 1.3 turbo, "Turbo 200" the 1.0 turbo.
      const engineLiters =
        litersOf(block.version) ?? (/\bt ?270\b|turbo 270/i.test(block.version) ? 1.3 : /\b(t ?200|turbo 200)\b/i.test(block.version) ? 1 : undefined);
      const turbo = /turbo|\bt ?\d{3}\b|\b(tce|tsi|thp|tb)\b/i.test(block.version) || (engineLiters !== undefined ? false : undefined);
      const diesel = /diesel|\btd\d*\b/i.test(block.version) || (/\b(flex|gasolina|hurricane|firefly)\b|t ?270|turbo 200/i.test(block.version) ? false : undefined);
      const transmission = transmissionIn(block.version) ?? (/\b(at\d?|aut)\b/i.test(block.version) ? "automatico" : undefined);
      // The block it adds to: the nearest one above whose version has the base's words.
      const baseWords = block.base ? words(block.base).filter((word) => !familyWords.has(word)) : [];
      const shared = (other: { version: string }) => words(other.version).filter((word) => words(block.version).includes(word)).length;
      // "Todos os itens acima mais": the one above.
      const base = block.base === "acima"
        ? blocks[blocks.indexOf(block) - 1]
        : block.base
        ? blocks
            .slice(0, blocks.indexOf(block))
            .reverse()
            .filter((other) => baseWords.every((word) => words(other.version).includes(word)))
            // The one most like it, then the plainest: "Freedom" of a "Volcano Turbo 270 Flex AT6" is the
            // "Freedom Turbo 270 Flex AT6", not the "Freedom Turbo Diesel AT9 4x4" below it.
            .sort((a, b) => shared(b) - shared(a) || words(a.version).length - words(b.version).length)[0]
        : undefined;
      candidates.push({
        key,
        brand: source.brand,
        ...(source.brand === "stellantis" && { fipeBrands: [named.brand] }),
        line: named.family,
        title: `${named.family} · ${block.version} (release ${release.date.slice(0, 7)})`,
        trims,
        years: year ? [year, year] : [dateYear, dateYear + 1],
        ...(engineLiters !== undefined && { engineLiters }),
        ...(turbo !== undefined && { turbo }),
        ...(diesel !== undefined && { diesel }),
        ...(transmission && { transmission }),
        page: release.url,
        ...(base && { addsTo: keys[blocks.indexOf(base)] }),
        ...(block.base && !base && { baseName: block.base }),
        items: block.items,
        optional: block.optional,
        prose: block.prose,
        release: { title: release.title, date: release.date },
        text: block.lines,
      });
    }
  }
}

candidates.sort((a, b) => b.release.date.localeCompare(a.release.date));
await writeFileRetrying("data/imprensa/equipamentos-candidates.json", `${JSON.stringify(candidates, null, 1)}\n`);
const prose = candidates.filter((candidate) => candidate.prose).length;
console.log(`${candidates.length} versões a revisar (${prose} em prosa) em data/imprensa/equipamentos-candidates.json`);
