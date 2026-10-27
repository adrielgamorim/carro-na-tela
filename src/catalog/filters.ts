import type { SizeClass, Steering } from "./inmetro";
import type { BodyHint, Transmission } from "./modelName";
import { listParams, toggleParams } from "./catalogParams";
import type { Origin } from "./fleet";
import type { CatalogEntry, Propulsion } from "./types";

export type CatalogSort =
  | "price-asc"
  | "price-desc"
  | "newest"
  | "consumption"
  | "popular"
  | "name";

export interface CatalogFilters {
  query: string;
  brands: string[];
  families: string[];
  sublines: string[];
  propulsions: Propulsion[];
  fuels: string[];
  transmissions: Transmission[];
  bodies: BodyHint[];
  doors: string[];
  sizes: SizeClass[];
  gears: string[];
  steerings: Steering[];
  origins: Origin[];
  yearMin: number | null;
  yearMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  /** Engine displacement in liters. */
  engineMin: number | null;
  engineMax: number | null;
  /** Minimum city km/l (INMETRO). */
  consumptionMin: number | null;
  zeroKmOnly: boolean;
  airConditioning: boolean;
  turbo: boolean;
  fourWheelDrive: boolean;
  sort: CatalogSort;
}

export const emptyCatalogFilters: CatalogFilters = {
  query: "",
  brands: [],
  families: [],
  sublines: [],
  propulsions: [],
  fuels: [],
  transmissions: [],
  bodies: [],
  doors: [],
  sizes: [],
  gears: [],
  steerings: [],
  origins: [],
  yearMin: null,
  yearMax: null,
  priceMin: null,
  priceMax: null,
  engineMin: null,
  engineMax: null,
  consumptionMin: null,
  zeroKmOnly: false,
  airConditioning: false,
  turbo: false,
  fourWheelDrive: false,
  sort: "price-asc",
};

export type ListFacet =
  | "brands"
  | "families"
  | "sublines"
  | "propulsions"
  | "fuels"
  | "transmissions"
  | "bodies"
  | "doors"
  | "sizes"
  | "gears"
  | "steerings"
  | "origins";
export type ToggleFacet =
  | "zeroKmOnly"
  | "turbo"
  | "fourWheelDrive"
  | "airConditioning";

const listFacetValue: Record<ListFacet, (entry: CatalogEntry) => string | undefined> = {
  brands: (entry) => entry.brand,
  families: (entry) => entry.family,
  sublines: (entry) => entry.subline,
  propulsions: (entry) => entry.propulsion,
  fuels: (entry) => entry.fuel,
  transmissions: (entry) => entry.transmission ?? undefined,
  bodies: (entry) => entry.bodyType ?? undefined,
  doors: (entry) => entry.attributes.doors?.toString(),
  sizes: (entry) => entry.size ?? undefined,
  gears: (entry) => entry.gears?.toString(),
  steerings: (entry) => entry.steering ?? undefined,
  origins: (entry) => entry.origin ?? undefined,
};

const toggleFacetTest: Record<ToggleFacet, (entry: CatalogEntry) => boolean> = {
  zeroKmOnly: (entry) => entry.zeroKm,
  turbo: (entry) => entry.attributes.aspiration === "turbo",
  fourWheelDrive: (entry) =>
    entry.attributes.fourWheelDrive === true || entry.inmetro?.fourWheelDrive === true,
  airConditioning: (entry) => entry.airConditioning === true,
};

const listFacets = Object.keys(listFacetValue) as ListFacet[];
const toggleFacets = Object.keys(toggleFacetTest) as ToggleFacet[];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

/** 0 km entries count as newer than any model year. */
function entryYear(entry: CatalogEntry): number {
  return entry.zeroKm ? Number.POSITIVE_INFINITY : (entry.modelYear ?? 0);
}

// Text search runs for every entry once per facet on each keystroke, so the
// normalized text of each entry and of the query are computed once.
const haystacks = new WeakMap<CatalogEntry, string>();
function haystack(entry: CatalogEntry): string {
  let text = haystacks.get(entry);
  if (text === undefined) {
    text = normalize(`${entry.brand} ${entry.model} ${entry.codeFipe ?? ""}`);
    haystacks.set(entry, text);
  }
  return text;
}

let lastQuery = "";
let lastWords: string[] = [];
function queryWords(query: string): string[] {
  if (query !== lastQuery) {
    lastQuery = query;
    lastWords = normalize(query).split(/\s+/).filter(Boolean);
  }
  return lastWords;
}

function matches(
  entry: CatalogEntry,
  filters: CatalogFilters,
  skip?: ListFacet | ToggleFacet,
): boolean {
  if (filters.query.trim()) {
    const text = haystack(entry);
    if (!queryWords(filters.query).every((word) => text.includes(word))) return false;
  }

  for (const facet of listFacets) {
    const selected = filters[facet] as string[];
    if (facet === skip || selected.length === 0) continue;
    const value = listFacetValue[facet](entry);
    if (value === undefined || !selected.includes(value)) return false;
  }

  for (const facet of toggleFacets) {
    if (facet !== skip && filters[facet] && !toggleFacetTest[facet](entry)) {
      return false;
    }
  }

  const year = entryYear(entry);
  if (filters.yearMin !== null && year < filters.yearMin) return false;
  if (filters.yearMax !== null && year > filters.yearMax) return false;
  if (filters.engineMin !== null || filters.engineMax !== null) {
    const liters = entry.attributes.engineLiters;
    if (liters === undefined) return false;
    if (filters.engineMin !== null && liters < filters.engineMin) return false;
    if (filters.engineMax !== null && liters > filters.engineMax) return false;
  }

  if (
    filters.consumptionMin !== null &&
    (entry.cityKmL === null || entry.cityKmL < filters.consumptionMin)
  ) {
    return false;
  }

  // Unpriced entries cannot satisfy a price range.
  if (filters.priceMin !== null || filters.priceMax !== null) {
    if (entry.priceValue === null) return false;
    if (filters.priceMin !== null && entry.priceValue < filters.priceMin) return false;
    if (filters.priceMax !== null && entry.priceValue > filters.priceMax) return false;
  }

  return true;
}

export function filterCatalog(
  entries: CatalogEntry[],
  filters: CatalogFilters,
): CatalogEntry[] {
  return entries.filter((entry) => matches(entry, filters));
}

export interface FacetOption {
  value: string;
  count: number;
}

export interface CatalogFacets {
  lists: Record<ListFacet, FacetOption[]>;
  toggles: Record<ToggleFacet, number>;
}

/**
 * Counts per option, applying every filter except the facet's own, so a
 * selected option never hides its siblings and an option that would empty the
 * results shows a count of 0.
 */
export function computeFacets(
  entries: CatalogEntry[],
  filters: CatalogFilters,
): CatalogFacets {
  const lists = {} as CatalogFacets["lists"];
  for (const facet of listFacets) {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const value = listFacetValue[facet](entry);
      if (value !== undefined && !counts.has(value)) counts.set(value, 0);
    }
    for (const entry of entries) {
      if (!matches(entry, filters, facet)) continue;
      const value = listFacetValue[facet](entry);
      if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    lists[facet] = [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => left.value.localeCompare(right.value, "pt-BR"));
  }

  const toggles = {} as CatalogFacets["toggles"];
  for (const facet of toggleFacets) {
    toggles[facet] = entries.filter(
      (entry) => matches(entry, filters, facet) && toggleFacetTest[facet](entry),
    ).length;
  }

  return { lists, toggles };
}

export interface CatalogBounds {
  yearMin: number | null;
  yearMax: number | null;
  priceMin: number;
  priceMax: number;
  /** Distinct engine sizes in liters, ascending. */
  engines: number[];
}

export function catalogBounds(entries: CatalogEntry[]): CatalogBounds {
  const years = entries
    .filter((entry) => !entry.zeroKm && entry.modelYear !== null)
    .map((entry) => entry.modelYear as number);
  const prices = entries
    .map((entry) => entry.priceValue)
    .filter((price): price is number => price !== null);

  return {
    yearMin: years.length ? Math.min(...years) : null,
    yearMax: years.length ? Math.max(...years) : null,
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    engines: [
      ...new Set(
        entries
          .map((entry) => entry.attributes.engineLiters)
          .filter((liters): liters is number => liters !== undefined),
      ),
    ].sort((a, b) => a - b),
  };
}

/** One FIPE version (brand + model code) with all its model years, newest first. */
/** Entries never empty: a group exists because it has an entry. */
export type NonEmpty<T> = [T, ...T[]];

export interface CatalogGroup {
  key: string;
  /** Newest year first. */
  entries: NonEmpty<CatalogEntry>;
}

export function groupCatalog(
  entries: CatalogEntry[],
  sort: CatalogSort,
): CatalogGroup[] {
  const groups = new Map<string, CatalogEntry[]>();
  for (const entry of entries) {
    const key = `${entry.category}:${entry.brandCode}:${entry.modelCode}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  const result = [...groups].map(([key, items]): CatalogGroup => ({
    key,
    entries: [...items].sort((left, right) => entryYear(right) - entryYear(left)) as NonEmpty<CatalogEntry>,
  }));
  // Sort by the newest entry, which is the one a card shows first; versions
  // without a crawled price go last either way.
  const price = (group: CatalogGroup) => group.entries[0].priceValue;
  const byPrice = (left: CatalogGroup, right: CatalogGroup, direction: 1 | -1) => {
    const [a, b] = [price(left), price(right)];
    if (a === null || b === null) return (a === null ? 1 : 0) - (b === null ? 1 : 0);
    return direction * (a - b);
  };
  const name = (group: CatalogGroup) =>
    `${group.entries[0].brand} ${group.entries[0].model}`;
  const consumption = (group: CatalogGroup) => group.entries[0].cityKmL;
  const fleet = (group: CatalogGroup) => group.entries[0].fleet?.line.total ?? null;
  // By fleet, a line's many versions would fill the first pages (all Gols):
  // take each line's newest version first, then each line's second, and so on.
  const turn = new Map<CatalogGroup, number>();
  if (sort === "popular") {
    const byLine = new Map<string, CatalogGroup[]>();
    for (const group of result) {
      const { brand, family } = group.entries[0];
      // FIPE spells some families two ways ("UNO" / "Uno", "Ka" / "Ka+").
      const line = `${brand}\n${family.toUpperCase().replace(/[^A-Z0-9]/g, "")}`;
      byLine.set(line, [...(byLine.get(line) ?? []), group]);
    }
    for (const groups of byLine.values()) {
      groups
        .sort(
          (left, right) =>
            entryYear(right.entries[0]) - entryYear(left.entries[0]) ||
            name(left).localeCompare(name(right), "pt-BR"),
        )
        .forEach((group, index) => turn.set(group, index));
    }
  }

  return result.sort((left, right) => {
    const byName = name(left).localeCompare(name(right), "pt-BR");
    if (sort === "price-asc") return byPrice(left, right, 1) || byName;
    if (sort === "price-desc") return byPrice(left, right, -1) || byName;
    if (sort === "consumption") {
      const [a, b] = [consumption(left), consumption(right)];
      if (a === null || b === null) {
        return (a === null ? 1 : 0) - (b === null ? 1 : 0) || byName;
      }
      return b - a || byName;
    }
    if (sort === "popular") {
      const byTurn = turn.get(left)! - turn.get(right)!;
      if (byTurn) return byTurn;
      const [a, b] = [fleet(left), fleet(right)];
      if (a === null || b === null) {
        return (a === null ? 1 : 0) - (b === null ? 1 : 0) || byName;
      }
      return b - a || byName;
    }
    if (sort === "newest") {
      return entryYear(right.entries[0]) - entryYear(left.entries[0]) || byName;
    }
    return byName;
  });
}

export function countActiveFilters(filters: CatalogFilters): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    listFacets.reduce((total, facet) => total + filters[facet].length, 0) +
    toggleFacets.filter((facet) => filters[facet]).length +
    (filters.yearMin !== null || filters.yearMax !== null ? 1 : 0) +
    (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0) +
    (filters.engineMin !== null || filters.engineMax !== null ? 1 : 0) +
    (filters.consumptionMin !== null ? 1 : 0)
  );
}

// URL parameters, in Portuguese so shared links read naturally:
// ?marca=BYD&propulsao=eletrico&preco=100000-200000&ano=2020-&ordem=newest
const sorts: CatalogSort[] = ["price-asc", "price-desc", "newest", "consumption", "popular", "name"];

function formatRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  return `${min ?? ""}-${max ?? ""}`;
}

function parseRange(value: string | null): [number | null, number | null] {
  const match = value ? /^(\d+(?:\.\d+)?)?-(\d+(?:\.\d+)?)?$/.exec(value) : null;
  if (!match) return [null, null];
  return [
    match[1] ? Number(match[1]) : null,
    match[2] ? Number(match[2]) : null,
  ];
}

function parseConsumption(value: string | null): number | null {
  const number = value ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function writeCatalogParams(
  filters: CatalogFilters,
  params: URLSearchParams,
): void {
  const set = (key: string, value: string | null) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };

  set("q", filters.query.trim() || null);
  for (const facet of listFacets) {
    // Repeated keys keep values with commas intact.
    params.delete(listParams[facet]);
    for (const value of filters[facet]) params.append(listParams[facet], value);
  }
  for (const facet of toggleFacets) set(toggleParams[facet], filters[facet] ? "1" : null);
  set("ano", formatRange(filters.yearMin, filters.yearMax));
  set("preco", formatRange(filters.priceMin, filters.priceMax));
  set("motor", formatRange(filters.engineMin, filters.engineMax));
  set("consumo", filters.consumptionMin === null ? null : String(filters.consumptionMin));
  set("ordem", filters.sort === emptyCatalogFilters.sort ? null : filters.sort);
}

export function readCatalogParams(params: URLSearchParams): CatalogFilters {
  const [yearMin, yearMax] = parseRange(params.get("ano"));
  const [priceMin, priceMax] = parseRange(params.get("preco"));
  const [engineMin, engineMax] = parseRange(params.get("motor"));
  const sort = params.get("ordem") as CatalogSort | null;
  const filters: CatalogFilters = {
    ...emptyCatalogFilters,
    query: params.get("q") ?? "",
    yearMin,
    yearMax,
    priceMin,
    priceMax,
    engineMin,
    engineMax,
    consumptionMin: parseConsumption(params.get("consumo")),
    sort: sort && sorts.includes(sort) ? sort : emptyCatalogFilters.sort,
  };

  for (const facet of listFacets) {
    (filters[facet] as string[]) = params.getAll(listParams[facet]);
  }
  for (const facet of toggleFacets) {
    filters[facet] = params.get(toggleParams[facet]) === "1";
  }
  return filters;
}
