import { emptyCatalogFilters, filterCatalog } from "./filters";
import { catalogBrand } from "./brands";
import type { CatalogFilters } from "./filters";
import type { CatalogEntry } from "./types";
import type { VehicleCategory } from "../types/vehicle";

export interface VinFilterInput {
  /** FIPE brands of the chassis manufacturer. */
  brands: string[];
  modelYear: number | null;
  /** Model name from NHTSA vPIC, when known. */
  model?: string;
  /** The categories the manufacturer's name says ("Honda Motorcycles"); any when none. */
  categories?: VehicleCategory[];
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
 * matches). A year without versions is dropped too. The category is the first
 * where the brand has versions: of those the manufacturer names, the one
 * shown first.
 */
export function vinCatalogFilters(
  allEntries: CatalogEntry[],
  input: VinFilterInput,
  sort: CatalogFilters["sort"],
  shown: VehicleCategory = "cars",
): VinFilterResult {
  const named = input.categories?.length ? input.categories : (["cars", "motorcycles", "trucks"] as VehicleCategory[]);
  const order = [...new Set([shown, ...named])].filter((category) => named.includes(category));
  const wanted = [...new Set(input.brands.map(catalogBrand))];
  let category: VehicleCategory | undefined;
  let entries: CatalogEntry[] = [];
  let brands: string[] = [];
  for (const candidate of order) {
    entries = allEntries.filter((entry) => entry.category === candidate);
    const available = new Set(entries.map((entry) => entry.brand));
    brands = wanted.filter((brand) => available.has(brand));
    if (brands.length) {
      category = candidate;
      break;
    }
  }
  if (!category) return { filters: null, brands: [], year: null, model: null };

  let filters: CatalogFilters = { ...emptyCatalogFilters, category, sort, brands };
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
