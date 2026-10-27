import { emptyCatalogFilters, filterCatalog } from "./filters";
import type { CatalogFilters } from "./filters";
import type { CatalogEntry } from "./types";

export interface VinFilterInput {
  /** FIPE brands of the chassis manufacturer. */
  brands: string[];
  modelYear: number | null;
  /** Model name from NHTSA vPIC, when known. */
  model?: string;
}

export interface VinFilterResult {
  /** null when the manufacturer has no brand in the catalog. */
  filters: CatalogFilters | null;
  brands: string[];
  year: number | null;
  /** The model, when the catalog has versions that match it. */
  model: string | null;
}

/**
 * Catalog filters for a decoded chassis: the manufacturer's brands and the
 * model year, plus the vPIC model name when it finds something (vPIC says
 * "3 Series" where FIPE says "320iA", so the name is dropped if nothing
 * matches). A year without versions is dropped too.
 */
export function vinCatalogFilters(
  entries: CatalogEntry[],
  input: VinFilterInput,
  sort: CatalogFilters["sort"],
): VinFilterResult {
  const available = new Set(entries.map((entry) => entry.brand));
  const brands = input.brands.filter((brand) => available.has(brand));
  if (!brands.length) return { filters: null, brands, year: null, model: null };

  let filters: CatalogFilters = { ...emptyCatalogFilters, sort, brands };
  let year: number | null = null;
  if (input.modelYear !== null) {
    const withYear = { ...filters, yearMin: input.modelYear, yearMax: input.modelYear };
    if (filterCatalog(entries, withYear).length) {
      filters = withYear;
      year = input.modelYear;
    }
  }
  let model: string | null = null;
  if (input.model) {
    const withModel = { ...filters, query: input.model };
    if (filterCatalog(entries, withModel).length) {
      filters = withModel;
      model = input.model;
    }
  }
  return { filters, brands, year, model };
}
