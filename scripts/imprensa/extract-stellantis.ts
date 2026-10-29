// Finds trunk volume and torque in the cached Stellantis releases (npm run
// crawl:imprensa) and writes the ones not reviewed yet to
// data/imprensa/stellantis-candidates.json (not committed). Review them by
// hand into data/imprensa/stellantis.json: accepted ones go to `facts`
// (fixing family, words, value or engine as needed), wrong ones to `rejected`.
//
//   npm run extract:imprensa

import { readFile } from "node:fs/promises";
import { writeFileRetrying } from "../write-file.ts";
import { getModelFamily } from "../../src/services/fipeParsing.ts";
import type { CatalogIndexFile } from "../../src/catalog/indexFormat.ts";
import type { CachedRelease } from "./crawl-stellantis.ts";
import { engineIn, plainWords, sentences, torqueKgfm, trunkLiters } from "./press.ts";
import type { PressEngine } from "./press.ts";
import { candidateKey } from "./facts.ts";
import type { PressFactsFile, PressFact } from "./facts.ts";

const brandsOfRoom: Record<string, string[]> = {
  fiat: ["Fiat"], abarth: ["Fiat"], jeep: ["Jeep"], citroen: ["Citroën"], peugeot: ["Peugeot"],
  "psa-archive": ["Peugeot", "Citroën"], ram: ["RAM"], chrysler: ["Chrysler"], dodge: ["Dodge"],
  leapmotor: ["Leapmotor"],
};
// Words after a line's name that are not a model of their own.
const notAModel = new Set(["flex", "turbo", "diesel", "tb", "aut", "mec", "cd", "cs", "ce", "1", "2"]);

const index = JSON.parse(await readFile("public/catalog/index.json", "utf8")) as CatalogIndexFile;
const reviewed = JSON.parse(await readFile("data/imprensa/stellantis.json", "utf8")) as PressFactsFile;
const releases = (await readFile("data/imprensa/stellantis-releases.jsonl", "utf8"))
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line) as CachedRelease);

/** Brand → family → the words that follow the family in its FIPE names. */
const lines = new Map<string, Map<string, Set<string>>>();
for (const version of index.versions) {
  const brand = index.brands[version.b]?.name ?? "";
  const family = getModelFamily(version.n);
  if (!lines.has(brand)) lines.set(brand, new Map());
  const families = lines.get(brand)!;
  if (!families.has(family)) families.set(family, new Set());
  const next = plainWords(version.n.trim().slice(family.length)).trim().split(" ")[0];
  if (next && /^[a-z]{2,}$/.test(next) && !notAModel.has(next)) families.get(family)!.add(next);
}

/** The families of these brands a text names as a whole word. */
function familiesIn(text: string, brands: string[]) {
  const words = plainWords(text);
  const found: { brand: string; family: string }[] = [];
  for (const brand of brands) {
    for (const family of lines.get(brand)?.keys() ?? []) {
      const key = plainWords(family);
      if (key.trim().length < 2 || !words.includes(key)) continue;
      // "2008" is a Peugeot; elsewhere a four-digit number is a year.
      const year = Number(key) > 1950 && Number(key) < 2050;
      if (year && brand !== "Peugeot") continue;
      found.push({ brand, family });
    }
  }
  return found;
}

type Candidate = PressFact & { alsoIn: number; keys: string[] };
const known = new Set([...reviewed.facts.map((fact) => fact.key), ...reviewed.rejected]);
// The same figure of a line, already accepted (maybe with other words or years).
const accepted = new Set(
  reviewed.facts.map((fact) => [fact.brand, fact.family, fact.kind, fact.value, fact.engine?.liters].join("|")),
);
const candidates = new Map<string, Candidate>();
for (const release of releases) {
  if (release.status !== 200 || !release.text) continue;
  const room = release.url.split("/br-pt/")[1]?.split("/")[0] ?? "";
  const brands = brandsOfRoom[room] ?? [];
  const named = familiesIn(release.title, brands);
  if (named.length !== 1) continue;
  const { brand, family } = named[0]!;
  const titleYear = release.title.match(/\b(19[89]\d|20[0-4]\d)\b/)?.[1];
  const from = titleYear && titleYear !== family ? Number(titleYear) : Number(release.date.slice(0, 4));
  // "Fiat Pulse Abarth": the release is about the versions named Abarth.
  const after = plainWords(release.title).split(plainWords(family))[1]?.trim().split(" ")[0];
  const words = after && lines.get(brand)?.get(family)?.has(after) ? [after.toUpperCase()] : undefined;
  const source = { url: release.url, title: release.title, date: release.date };

  for (const sentence of sentences(release.text)) {
    // A sentence about another of the brand's models.
    const others = familiesIn(sentence, brands).filter((other) => other.family !== family);
    if (others.length && !plainWords(sentence).includes(plainWords(family))) continue;
    const found: { kind: PressFact["kind"]; value: number; engine?: PressEngine }[] = [];
    const trunk = trunkLiters(sentence);
    if (trunk) found.push({ kind: "trunk", value: trunk });
    const torque = torqueKgfm(sentence);
    const engine = torque ? engineIn(sentence) : undefined;
    if (torque && engine) found.push({ kind: "torque", value: torque, engine });
    for (const item of found) {
      const key = candidateKey(release.url, item.kind, item.value);
      const fact: PressFact = { key, brand, family, ...(words && { words }), ...item, from, source, quote: sentence.slice(0, 300) };
      // One candidate per finding; the same figure in later releases only counts.
      const group = [brand, family, words, item.kind, item.value, JSON.stringify(item.engine)].join("|");
      const earlier = candidates.get(group);
      if (!earlier) candidates.set(group, { ...fact, alsoIn: 0, keys: [key] });
      else if (from < earlier.from) candidates.set(group, { ...fact, alsoIn: earlier.alsoIn + 1, keys: [...earlier.keys, key] });
      else {
        earlier.alsoIn += 1;
        earlier.keys.push(key);
      }
    }
  }
}

// A group is reviewed once any of its releases was, or its figure was accepted.
const list = [...candidates.values()]
  .filter((candidate) => !candidate.keys.some((key) => known.has(key)))
  .filter(
    (candidate) =>
      !accepted.has([candidate.brand, candidate.family, candidate.kind, candidate.value, candidate.engine?.liters].join("|")),
  )
  .map(({ keys, ...candidate }) => {
    void keys;
    return candidate;
  })
  .sort(
  (a, b) => a.brand.localeCompare(b.brand) || a.family.localeCompare(b.family) || a.kind.localeCompare(b.kind) || a.from - b.from,
);
await writeFileRetrying("data/imprensa/stellantis-candidates.json", `${JSON.stringify(list, null, 1)}\n`);
console.log(`${list.length} candidatos a revisar em data/imprensa/stellantis-candidates.json`);
