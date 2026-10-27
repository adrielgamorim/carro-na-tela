import { parseModelName } from "../../src/catalog/modelName.ts";
import type { ModelNameAttributes } from "../../src/catalog/modelName.ts";
import {
  parseFipePrice,
  parseFipeYearCode,
} from "../../src/services/fipeParsing.ts";
import { FipeRequestError, FipeStopError } from "./fipe-client.ts";
import type { FipeClient } from "./fipe-client.ts";

// Two phases, both newest model years first so a partial crawl is still the
// most useful slice of the catalog:
//   1. listing: brands → years → models of each brand-year. Cheap (one request
//      per brand-year) and enough to know every version, year and fuel.
//   2. prices:  one detail request per version-year, for price and code FIPE.
// The snapshot is always assembled from the disk cache, so it covers every run
// so far, not just the current one.

export const zeroKmYear = 32000;

export type FipeCategory = "cars" | "motorcycles" | "trucks";

interface FipeOption {
  code: string;
  name: string;
}

interface FipeDetail {
  brand: string;
  model: string;
  codeFipe: string;
  fuel: string;
  fuelAcronym: string;
  modelYear: number;
  price: string;
  referenceMonth: string;
}

/** A version-year known from the listing phase. */
export interface ListedVehicle {
  brandCode: string;
  brand: string;
  modelCode: string;
  model: string;
  yearCode: string;
  modelYear: number;
  fuel: string;
}

export interface CrawledVehicle extends ListedVehicle {
  /** `${brandCode}-${modelCode}:${yearCode}` */
  id: string;
  zeroKm: boolean;
  attributes: ModelNameAttributes;
  /** Present once the price phase fetched the detail. */
  detail: {
    codeFipe: string;
    fuelAcronym: string;
    price: string;
    priceValue: number;
    referenceMonth: string;
  } | null;
}

export interface CrawlOptions {
  reference: string;
  category?: FipeCategory;
  minYear?: number;
  brandCodes?: string[];
  log?: (message: string) => void;
}

interface PhaseResult {
  complete: boolean;
  stopReason?: string;
  failures: { path: string; status: number }[];
}

export interface ListingResult extends PhaseResult {
  vehicles: ListedVehicle[];
  availableBrands: number;
  brandYears: number;
}

export interface PricesResult extends PhaseResult {
  fetched: number;
}

function yearFuel(year: FipeOption): string {
  return year.name.replace(/^\d+\s*/, "").trim();
}

/** 0 km first, then newest model year; ties keep brand/model order. */
export function priceOrder(left: ListedVehicle, right: ListedVehicle): number {
  const year = (vehicle: ListedVehicle) =>
    vehicle.modelYear === zeroKmYear ? Number.POSITIVE_INFINITY : vehicle.modelYear;
  return year(right) - year(left);
}

function context(client: FipeClient, options: CrawlOptions) {
  const failures: PhaseResult["failures"] = [];
  const { reference } = options;

  // A failed item (e.g. a 400 for one model) is skipped; stop errors
  // (budget, rate limit, network) propagate and end the phase.
  async function tryGet<T>(path: string): Promise<T | null> {
    try {
      return await client.get<T>(path, { reference });
    } catch (error) {
      if (error instanceof FipeRequestError) {
        failures.push({ path, status: error.status });
        return null;
      }
      throw error;
    }
  }

  return { failures, tryGet };
}

function stopped(error: unknown, log: (message: string) => void) {
  if (!(error instanceof FipeStopError)) throw error;
  log(`Parando: ${error.message}`);
  return error.message;
}

export async function crawlListing(
  client: FipeClient,
  options: CrawlOptions,
): Promise<ListingResult> {
  const category = options.category ?? "cars";
  const minYear = options.minYear ?? 2009;
  const log = options.log ?? (() => {});
  const { failures, tryGet } = context(client, options);
  const vehicles: ListedVehicle[] = [];
  let availableBrands = 0;
  let brandYears = 0;

  try {
    const allBrands = (await tryGet<FipeOption[]>(`/${category}/brands`)) ?? [];
    availableBrands = allBrands.length;
    const brands = options.brandCodes
      ? allBrands.filter((brand) => options.brandCodes!.includes(brand.code))
      : allBrands;

    // Every brand's year list first, then the model lists newest year first
    // across brands, so a partial listing covers recent years of all brands.
    const pairs: { brand: FipeOption; year: FipeOption; modelYear: number }[] = [];
    for (const brand of brands) {
      const years = (await tryGet<FipeOption[]>(`/${category}/brands/${brand.code}/years`)) ?? [];
      for (const year of years) {
        const parsed = parseFipeYearCode(year.code);
        if (parsed && (parsed.modelYear === zeroKmYear || parsed.modelYear >= minYear)) {
          pairs.push({ brand, year, modelYear: parsed.modelYear });
        }
      }
    }
    log(`${brands.length} marcas, ${pairs.length} combinações marca-ano`);

    const year = (modelYear: number) =>
      modelYear === zeroKmYear ? Number.POSITIVE_INFINITY : modelYear;
    pairs.sort((left, right) => year(right.modelYear) - year(left.modelYear));

    let lastYear: number | undefined;
    for (const { brand, year: brandYear, modelYear } of pairs) {
      if (modelYear !== lastYear && lastYear !== undefined) {
        log(`Listagem até ${lastYear === zeroKmYear ? "0 km" : lastYear}: ${vehicles.length} versões-ano`);
      }
      lastYear = modelYear;

      const models =
        (await tryGet<FipeOption[]>(
          `/${category}/brands/${brand.code}/years/${encodeURIComponent(brandYear.code)}/models`,
        )) ?? [];
      brandYears += 1;
      for (const model of models) {
        vehicles.push({
          brandCode: brand.code,
          brand: brand.name,
          modelCode: model.code,
          model: model.name.replace(/\s+/g, " ").trim(),
          yearCode: brandYear.code,
          modelYear,
          fuel: yearFuel(brandYear),
        });
      }
    }
  } catch (error) {
    return {
      vehicles,
      availableBrands,
      brandYears,
      complete: false,
      stopReason: stopped(error, log),
      failures,
    };
  }

  return { vehicles, availableBrands, brandYears, complete: true, failures };
}

function detailPath(category: FipeCategory, vehicle: ListedVehicle) {
  return `/${category}/brands/${vehicle.brandCode}/models/${vehicle.modelCode}/years/${encodeURIComponent(vehicle.yearCode)}`;
}

export async function crawlPrices(
  client: FipeClient,
  listed: ListedVehicle[],
  options: CrawlOptions,
): Promise<PricesResult> {
  const category = options.category ?? "cars";
  const log = options.log ?? (() => {});
  const { failures, tryGet } = context(client, options);
  const queue = [...listed].sort(priceOrder);
  let fetched = 0;

  try {
    for (const vehicle of queue) {
      await tryGet<FipeDetail>(detailPath(category, vehicle));
      fetched += 1;
      if (fetched % 250 === 0) log(`Preços: ${fetched} de ${queue.length}`);
    }
  } catch (error) {
    return { fetched, complete: false, stopReason: stopped(error, log), failures };
  }
  return { fetched, complete: true, failures };
}

/**
 * Builds the snapshot from cached responses only. Pass an offline client so
 * nothing is requested: missing listings or details are simply absent.
 */
export async function assembleSnapshot(
  offlineClient: FipeClient,
  options: CrawlOptions,
) {
  const category = options.category ?? "cars";
  const missesBefore = offlineClient.stats().cacheMisses;
  const listing = await crawlListing(offlineClient, { ...options, log: undefined });
  // Any listing response not cached yet means some versions are unknown.
  const listingComplete = offlineClient.stats().cacheMisses === missesBefore;
  const vehicles: CrawledVehicle[] = [];

  for (const listed of listing.vehicles) {
    const detail = await offlineClient.get<FipeDetail>(detailPath(category, listed), {
      reference: options.reference,
    });
    vehicles.push({
      ...listed,
      id: `${listed.brandCode}-${listed.modelCode}:${listed.yearCode}`,
      zeroKm: listed.modelYear === zeroKmYear,
      attributes: parseModelName(listed.model),
      detail: detail
        ? {
            codeFipe: detail.codeFipe,
            fuelAcronym: detail.fuelAcronym,
            price: detail.price,
            priceValue: parseFipePrice(detail.price),
            referenceMonth: detail.referenceMonth,
          }
        : null,
    });
  }

  const priced = vehicles.filter((vehicle) => vehicle.detail).length;
  return {
    vehicles,
    listingComplete,
    pricesComplete: listingComplete && priced === vehicles.length,
    stats: {
      availableBrands: listing.availableBrands,
      brands: new Set(vehicles.map((vehicle) => vehicle.brandCode)).size,
      brandYears: listing.brandYears,
      listed: vehicles.length,
      priced,
    },
  };
}
