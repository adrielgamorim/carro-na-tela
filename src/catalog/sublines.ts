import { getModelFamily } from "../services/fipeParsing.ts";

// Model line and sub-line of FIPE version names, for the catalog filters.
//
// The line is the first word of the name ("Uno"), spelled once per brand: FIPE
// writes some both ways ("UNO WAY 1.0…", "Uno Mille 1.0…"). The sub-line is
// the word after it ("Uno Way", "Uno Mille", "Onix Hatch"), when it is a name
// and not the engine ("Gol 1.6 Mi" has none). FIPE abbreviates freely, so an
// abbreviation joins the most common full word of the line that starts with it:
//
//   ATTRACTI. / ATTRACTIVE → Attractive    Adv. / Adventure → Adventure    SD. / SEDAN → Sedan
//
// (an abbreviation keeps the first letter and some of the others, in order).

export interface VersionLine {
  family: string;
  /** "Uno Way"; null when the name has no sub-line. */
  subline: string | null;
}

// Engine, fuel and body codes that come right after some lines' names.
const notASubline = new Set([
  "mi", "mpi", "msi", "tsi", "tfsi", "tdi", "tb", "turbo", "flex", "fire", "total", "power",
  "gasolina", "diesel", "alcool", "eletrico", "hibrido", "cd", "cs", "ce", "cab", "aut", "mec",
]);

const plain = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");

/** Most common spelling, preferring one with lowercase letters ("Uno" over "UNO"). */
function preferredSpelling(counts: Map<string, number>): string {
  const ranked = [...counts].sort(
    ([left, leftCount], [right, rightCount]) =>
      Number(/\p{Ll}/u.test(right)) - Number(/\p{Ll}/u.test(left)) || rightCount - leftCount || left.localeCompare(right),
  );
  return ranked[0]?.[0] ?? "";
}

/** "ATTRACTIVE" → "Attractive", "WAY" → "Way"; codes stay ("LTZ", "HGT", "RS", "SE-G"). */
function displayWord(word: string): string {
  if (/\p{Ll}/u.test(word) || word.includes("-")) return word;
  const titled = word.length >= 4 || (word.length === 3 && /[AEIOU]/.test(word[1] ?? ""));
  return titled ? word.charAt(0) + word.slice(1).toLocaleLowerCase("pt-BR") : word;
}

/** "adv" of "adventure", "sd" of "sedan": same first letter, the rest in order. */
function abbreviates(short: string, full: string): boolean {
  if (short[0] !== full[0] || short.length >= full.length) return false;
  let at = 0;
  for (const letter of full) if (letter === short[at]) at += 1;
  return at === short.length;
}

// Abbreviations whose full word the line itself never spells out.
const knownAbbreviations: Record<string, string> = {
  adv: "Adventure",
  advant: "Advantage",
  cel: "Celebration",
  celeb: "Celebration",
  celebr: "Celebration",
  comf: "Comfort",
  exec: "Executive",
  sed: "Sedan",
  week: "Weekend",
};

interface SublineWord {
  word: string;
  /** Letters only, lowercase: the key words are grouped by. */
  key: string;
  /** May abbreviate a longer word: "Adv.", "Adv/Adv", "P-Up". */
  short: boolean;
}

/** The word right after the family: "Adv.1.8" → Adv (short), "1.6" → none. */
function sublineWord(name: string, family: string): SublineWord | null {
  const rest = name.trim().split(/\s+/).slice(family.split(" ").length).join(" ");
  const match = /^(\p{L}[\p{L}-]*)(\.|\/)?/u.exec(rest);
  const word = match?.[1];
  if (!word) return null;
  const key = plain(word.replace(/-/g, ""));
  if (key.length < 2 || notASubline.has(key)) return null;
  return { word, key, short: match[2] !== undefined || word.includes("-") };
}

/** Line and sub-line of each version, given as [brand, version name]. */
export function versionLines(versions: [brand: string, name: string][]): VersionLine[] {
  const families = versions.map(([brand, name]) => ({ brand, family: getModelFamily(name), name }));
  const lineKey = (brand: string, family: string) => `${brand}\n${plain(family)}`;

  // One spelling per line, and the spellings of each sub-line word in it.
  const spellings = new Map<string, Map<string, number>>();
  const words = new Map<string, Map<string, Map<string, number>>>();
  for (const { brand, family, name } of families) {
    const key = lineKey(brand, family);
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(family, (counts.get(family) ?? 0) + 1);
    spellings.set(key, counts);
    const found = sublineWord(name, family);
    if (!found) continue;
    const byWord = words.get(key) ?? new Map<string, Map<string, number>>();
    const wordCounts = byWord.get(found.key) ?? new Map<string, number>();
    wordCounts.set(found.word, (wordCounts.get(found.word) ?? 0) + 1);
    byWord.set(found.key, wordCounts);
    words.set(key, byWord);
  }
  const total = (spelled: Map<string, number>) => [...spelled.values()].reduce((sum, count) => sum + count, 0);

  return families.map(({ brand, family, name }) => {
    const key = lineKey(brand, family);
    const line = preferredSpelling(spellings.get(key) ?? new Map([[family, 1]]));
    const found = sublineWord(name, family);
    if (!found) return { family: line, subline: null };
    const lineWords = words.get(key) ?? new Map<string, Map<string, number>>();
    let spelled = preferredSpelling(lineWords.get(found.key) ?? new Map([[found.word, 1]]));
    if (found.short) {
      // The most used longer word of the line it abbreviates, else a known one.
      const full = [...lineWords]
        .filter(([other]) => abbreviates(found.key, other))
        .map(([, counts]) => counts)
        .sort((left, right) => total(right) - total(left))[0];
      spelled = full ? preferredSpelling(full) : (knownAbbreviations[found.key] ?? spelled);
    }
    return { family: line, subline: `${line} ${displayWord(spelled)}` };
  });
}
