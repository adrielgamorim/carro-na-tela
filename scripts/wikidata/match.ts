// Matches FIPE versions to Wikidata car models by name. FIPE names start with
// the model ("ONIX PLUS LTZ 1.0 Turbo"), Wikidata labels with the brand
// ("Chevrolet Onix"), so the label minus the brand must equal the first words
// of the FIPE name. A model page describes the whole line, never the exact
// version, so every match is "fuzzy".

/** One car model (or model series / generation) from Wikidata. */
export interface WikidataModel {
  id: string;
  /** Portuguese label, else English. */
  label: string;
  /** Labels first (en, pt), then aliases. */
  names: string[];
  /** How many of `names` are labels (the rest are aliases). */
  labelCount: number;
  /** Manufacturer and brand labels (English). */
  brands: string[];
  /** Commons file name of the main image. */
  image?: string;
  /** Portuguese Wikipedia article title. */
  ptwiki?: string;
  /** Short Wikidata description in Portuguese. */
  description?: string;
  /** Production years, when known (generations usually have them). */
  from?: number;
  to?: number;
}

/**
 * Manual correction (data/wikidata/overrides.json): FIPE versions of a brand
 * whose name is `model` or starts with `modelPrefix` (any case) use the
 * Wikidata item `id`, or none at all.
 */
export interface WikidataOverride {
  brand: string;
  model?: string;
  modelPrefix?: string;
  id?: string;
  none?: boolean;
  reason?: string;
}

export interface FipeVersionForWikidata {
  brand: string;
  model: string;
  /** Model years of the version (0 km counts as the current year). */
  years: number[];
}

// FIPE brand name → how Wikidata names it (first one is the main name).
export const brandNames: Record<string, string[]> = {
  "GM - Chevrolet": ["Chevrolet"],
  "VW - VolksWagen": ["Volkswagen", "VW"],
  "Kia Motors": ["Kia"],
  "Caoa Chery": ["Chery"],
  "Caoa Chery/Chery": ["Chery"],
  "Caoa Changan": ["Changan"],
  CHANA: ["Chana", "Changan"],
  "Mercedes-Benz": ["Mercedes-Benz", "Mercedes"],
  GWM: ["GWM", "Great Wall", "Haval"],
  "Land Rover": ["Land Rover", "Range Rover"],
};

function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

const compact = (list: string[]) => list.join("");

function namesOfBrand(brand: string): string[][] {
  return (brandNames[brand] ?? [brand]).map(words);
}

// A chassis code ending a name: "Land Rover Defender L663", "Mercedes-Benz W166".
const chassisCode = /^[A-Z]{1,2}\d{3}$/;

/**
 * Keys a Wikidata name can match: the name without the brand, and whole; also
 * without a year in parentheses ("BMW i3 (2013)", "BMW Série 3 (F30)") and
 * without a final chassis code ("Defender L663"), as FIPE names never have them.
 */
function nameKeys(
  name: string,
  brandWords: string[][],
  brandListed: boolean,
): { key: string; derived: boolean }[] {
  const keys: { key: string; derived: boolean }[] = [];
  const plain = words(name.replace(/\s*\([^)]*\)/g, ""));
  const variants = [words(name), plain];
  if (plain.length > 1 && chassisCode.test(plain.at(-1) ?? "")) variants.push(plain.slice(0, -1));
  variants.forEach((variant, index) => {
    for (const key of variantKeys(variant, brandWords, brandListed)) {
      if (!keys.some((item) => item.key === key)) keys.push({ key, derived: index > 0 });
    }
  });
  return keys;
}

function variantKeys(nameWords: string[], brandWords: string[][], brandListed: boolean): string[] {
  const keys: string[] = [];
  let startsWithBrand = false;
  for (const brand of brandWords) {
    if (nameWords.length > brand.length && compact(nameWords.slice(0, brand.length)) === compact(brand)) {
      keys.push(compact(nameWords.slice(brand.length)));
      startsWithBrand = true;
    }
  }
  // A name that is only the brand ("Mercedes-Benz W166" minus its code) matches nothing.
  const onlyBrand = brandWords.some((brand) => compact(brand) === compact(nameWords));
  if ((startsWithBrand || brandListed) && !onlyBrand) keys.push(compact(nameWords));
  // "Mercedes-Benz C-Class" is sold as "C-200", "C-180"…
  for (const key of [...keys]) {
    const series = /^(.+?)(CLASS|KLASSE|CLASSE)$/.exec(key);
    if (series?.[1]) keys.push(series[1]);
  }
  return keys;
}

interface Candidate {
  model: WikidataModel;
  byLabel: boolean;
  brandListed: boolean;
  /** Matched only without the parentheses or chassis code of its name. */
  derived: boolean;
}

function periodScore(model: WikidataModel, years: number[]): number {
  if (model.from === undefined) return 0;
  const to = model.to ?? Number.POSITIVE_INFINITY;
  return years.some((year) => year >= model.from! && year <= to) ? 1 : -1;
}

/**
 * Best candidate first: right brand, the generation of the version's years
 * (named "Polo Mk6", found by its "Polo" alias), a label rather than an alias,
 * then a picture and an article.
 */
function rank(candidates: Candidate[], years: number[]): WikidataModel {
  const score = (candidate: Candidate) => [
    candidate.brandListed ? 1 : 0,
    periodScore(candidate.model, years),
    // "Volkswagen Passat" over "Volkswagen Passat (B1)" unless the years tell.
    candidate.derived ? 0 : 1,
    candidate.byLabel ? 1 : 0,
    candidate.model.image ? 1 : 0,
    candidate.model.ptwiki ? 1 : 0,
  ];
  const [best] = [...candidates].sort((left, right) => {
    const a = score(left);
    const b = score(right);
    const index = a.findIndex((value, position) => value !== b[position]);
    return index === -1
      ? left.model.id.localeCompare(right.model.id)
      : (b[index] ?? 0) - (a[index] ?? 0);
  });
  if (!best) throw new Error("rank() sem candidatos");
  return best.model;
}

// BMW engine suffixes ("320iA", "118d") are not body variants like "HB20S".
const engineSuffixes = new Set(["I", "IA", "IL", "D", "DA", "E"]);

// FIPE abbreviations of Land Rover lines.
const landRoverWords: Record<string, string[]> = {
  DEF: ["DEFENDER"],
  DEFE: ["DEFENDER"],
  DISC: ["DISCOVERY"],
  DISCOV: ["DISCOVERY"],
};

/**
 * Other ways to read a FIPE name, tried after the name itself: BMW engine
 * codes name the series ("320iA" is a "Série 3"), and Land Rover names are
 * abbreviated ("Defe. 110", "Discov.", "Discovery4", "Range.R.").
 */
export function fipeNameAliases(brand: string, fipeWords: string[]): string[][] {
  const aliases: string[][] = [];
  if (brand === "BMW") {
    const series = /^(\d)\d\d[A-Z]*$/.exec(fipeWords[0] ?? "");
    if (series?.[1]) aliases.push(["SERIE", series[1], ...fipeWords.slice(1)]);
  }
  if (brand === "Land Rover") {
    const expanded = fipeWords.flatMap((word, index) => {
      if (word === "R" && fipeWords[index - 1] === "RANGE") return ["ROVER"];
      const number = /^(DISCOVERY)(\d)$/.exec(word);
      if (number?.[1] && number[2]) return [number[1], number[2]];
      return landRoverWords[word] ?? [word];
    });
    // Word by word: "DISCOVERY4" → "DISCOVERY 4" compacts to the same text.
    if (expanded.join(" ") !== fipeWords.join(" ")) aliases.push(expanded);
  }
  return aliases;
}

const lower = (text: string) => text.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");

/** The manual correction that applies to a FIPE version, if any. */
export function findWikidataOverride(
  overrides: WikidataOverride[],
  version: Pick<FipeVersionForWikidata, "brand" | "model">,
): WikidataOverride | undefined {
  const name = lower(version.model);
  return overrides.find(
    (item) =>
      lower(item.brand) === lower(version.brand) &&
      (item.model
        ? lower(item.model) === name
        : item.modelPrefix !== undefined && name.startsWith(lower(item.modelPrefix))),
  );
}

export function createWikidataMatcher(
  models: WikidataModel[],
  overrides: WikidataOverride[] = [],
) {
  const byBrand = new Map<string, Map<string, Candidate[]>>();
  const byId = new Map(models.map((model) => [model.id, model]));

  function keysFor(brand: string) {
    let keys = byBrand.get(brand);
    if (keys) return keys;
    keys = new Map();
    const brandWords = namesOfBrand(brand);
    const brandKeys = brandWords.map(compact);
    for (const model of models) {
      const brandListed = model.brands.some((name) =>
        brandKeys.some((key) => compact(words(name)).startsWith(key)),
      );
      const seen = new Map<string, Candidate>();
      model.names.forEach((name, index) => {
        for (const { key, derived } of nameKeys(name, brandWords, brandListed)) {
          if (!key) continue;
          const earlier = seen.get(key);
          if (earlier) {
            // "Jeep Commander (2021)" is also labeled "Jeep Commander": exact after
            // all, and a label only if that exact name is one ("Bmw x3" is an alias).
            if (earlier.derived && !derived) {
              earlier.derived = false;
              earlier.byLabel = index < model.labelCount;
            }
            continue;
          }
          const list = keys!.get(key) ?? [];
          const candidate = { model, byLabel: index < model.labelCount, brandListed, derived };
          seen.set(key, candidate);
          list.push(candidate);
          keys!.set(key, list);
        }
      });
    }
    byBrand.set(brand, keys);
    return keys;
  }

  return function match(version: FipeVersionForWikidata): WikidataModel | null {
    const override = findWikidataOverride(overrides, version);
    if (override) return override.id ? (byId.get(override.id) ?? null) : null;

    const keys = keysFor(version.brand);
    let fipeWords = words(version.model);
    if (fipeWords[0] === "CLASSE" && fipeWords.length > 1) fipeWords = fipeWords.slice(1);

    // Longest model name first: "Onix Plus" over "Onix"; the name as FIPE
    // writes it before its aliases.
    for (const attempt of [fipeWords, ...fipeNameAliases(version.brand, fipeWords)]) {
      for (let count = Math.min(3, attempt.length); count >= 1; count -= 1) {
        const candidates = keys.get(compact(attempt.slice(0, count)));
        if (candidates) return rank(candidates, version.years);
      }
    }
    // A letter glued to the model: "HB20S", "HB20X" → "HB20".
    const glued = /^(.*\d)([A-Z]{1,2})$/.exec(fipeWords[0] ?? "");
    const candidates =
      glued && !engineSuffixes.has(glued[2] ?? "") ? keys.get(glued[1] ?? "") : undefined;
    return candidates ? rank(candidates, version.years) : null;
  };
}

interface SparqlValue {
  value: string;
}

/** Turns the rows of the SPARQL query in fetch-wikidata.ts into models. */
export function parseSparqlModels(rows: Record<string, SparqlValue | undefined>[]): WikidataModel[] {
  const list = (value: SparqlValue | undefined) => (value?.value ? value.value.split("|") : []);
  const year = (value: SparqlValue | undefined) => (value?.value ? Number(value.value) : undefined);
  const byId = new Map<string, WikidataModel>();

  for (const row of rows) {
    const id = row.m!.value.split("/").pop()!;
    // "mul" (every language) last: many items now carry only it.
    const labels = [row.pt?.value, row.en?.value, row.mul?.value].filter((label): label is string => !!label);
    const [label] = labels;
    if (!label) continue;
    const names = [...new Set([...labels, ...list(row.aliases)])];
    const model: WikidataModel = {
      id,
      label,
      names,
      labelCount: new Set(labels).size,
      brands: list(row.brands),
      ...(row.image && { image: decodeURIComponent(row.image.value.split("/").pop()!) }),
      ...(row.ptwiki && { ptwiki: decodeURIComponent(row.ptwiki.value.split("/wiki/").pop()!) }),
      ...(row.ptDesc && { description: row.ptDesc.value }),
      ...(year(row.from) !== undefined && { from: year(row.from) }),
      ...(year(row.to) !== undefined && { to: year(row.to) }),
    };
    // GROUP BY can still repeat an item with several labels in one language.
    if (!byId.has(id)) byId.set(id, model);
  }
  return [...byId.values()];
}
