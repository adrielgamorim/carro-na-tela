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

/** Keys a Wikidata name can match: the name without the brand, and whole. */
function nameKeys(name: string, brandWords: string[][], brandListed: boolean): string[] {
  const nameWords = words(name);
  const keys: string[] = [];
  let startsWithBrand = false;
  for (const brand of brandWords) {
    if (nameWords.length > brand.length && compact(nameWords.slice(0, brand.length)) === compact(brand)) {
      keys.push(compact(nameWords.slice(brand.length)));
      startsWithBrand = true;
    }
  }
  if (startsWithBrand || brandListed) keys.push(compact(nameWords));
  // "Mercedes-Benz C-Class" is sold as "C-200", "C-180"…
  for (const key of [...keys]) {
    const series = /^(.+?)(CLASS|KLASSE|CLASSE)$/.exec(key);
    if (series) keys.push(series[1]);
  }
  return keys;
}

interface Candidate {
  model: WikidataModel;
  byLabel: boolean;
  brandListed: boolean;
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
    candidate.byLabel ? 1 : 0,
    candidate.model.image ? 1 : 0,
    candidate.model.ptwiki ? 1 : 0,
  ];
  return [...candidates].sort((left, right) => {
    const a = score(left);
    const b = score(right);
    const index = a.findIndex((value, position) => value !== b[position]);
    return index === -1 ? left.model.id.localeCompare(right.model.id) : b[index] - a[index];
  })[0].model;
}

// BMW engine suffixes ("320iA", "118d") are not body variants like "HB20S".
const engineSuffixes = new Set(["I", "IA", "IL", "D", "DA", "E"]);

const lower = (text: string) => text.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");

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
      const seen = new Set<string>();
      model.names.forEach((name, index) => {
        for (const key of nameKeys(name, brandWords, brandListed)) {
          if (!key || seen.has(key)) continue;
          seen.add(key);
          const list = keys!.get(key) ?? [];
          list.push({ model, byLabel: index < model.labelCount, brandListed });
          keys!.set(key, list);
        }
      });
    }
    byBrand.set(brand, keys);
    return keys;
  }

  return function match(version: FipeVersionForWikidata): WikidataModel | null {
    const name = lower(version.model);
    const override = overrides.find(
      (item) =>
        lower(item.brand) === lower(version.brand) &&
        (item.model
          ? lower(item.model) === name
          : item.modelPrefix !== undefined && name.startsWith(lower(item.modelPrefix))),
    );
    if (override) return override.id ? (byId.get(override.id) ?? null) : null;

    const keys = keysFor(version.brand);
    let fipeWords = words(version.model);
    if (fipeWords[0] === "CLASSE" && fipeWords.length > 1) fipeWords = fipeWords.slice(1);

    // Longest model name first: "Onix Plus" over "Onix".
    for (let count = Math.min(3, fipeWords.length); count >= 1; count -= 1) {
      const candidates = keys.get(compact(fipeWords.slice(0, count)));
      if (candidates) return rank(candidates, version.years);
    }
    // A letter glued to the model: "HB20S", "HB20X" → "HB20".
    const glued = /^(.*\d)([A-Z]{1,2})$/.exec(fipeWords[0] ?? "");
    const candidates =
      glued && !engineSuffixes.has(glued[2]) ? keys.get(glued[1]) : undefined;
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
    const labels = [row.pt?.value, row.en?.value].filter((label): label is string => !!label);
    if (labels.length === 0) continue;
    const names = [...new Set([...labels, ...list(row.aliases)])];
    const model: WikidataModel = {
      id,
      label: labels[0],
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
