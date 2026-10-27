import type {
  FipePriceHistory,
  FipeVehicle,
  VehicleCategory,
  VehicleFilters,
} from "../types/vehicle";
import {
  getModelFamily,
  parseFipePrice,
  parseFipeYearCode,
  zeroKmModelYear,
} from "./fipeParsing";
import { createRequestCache, requestJson } from "./http";

export interface FipeReference {
  code: string;
  month: string;
}

export interface FipeOption {
  code: string;
  name: string;
}

export {
  formatModelYear,
  getModelFamily,
  parseFipePrice,
  parseFipeYearCode,
  zeroKmModelYear,
} from "./fipeParsing";
export type { FipeYearCode } from "./fipeParsing";

export function getModelFamilies(models: FipeOption[]): string[] {
  const families = new Map<string, string>();

  for (const model of models) {
    const family = getModelFamily(model.name);
    const key = family.toLocaleLowerCase("pt-BR");
    if (family && !families.has(key)) families.set(key, family);
  }

  return [...families.values()];
}

export function filterModelsByFamily(
  models: FipeOption[],
  family: string,
): FipeOption[] {
  const familyKey = getModelFamily(family).toLocaleLowerCase("pt-BR");

  return models.filter(
    (model) =>
      getModelFamily(model.name).toLocaleLowerCase("pt-BR") === familyKey,
  );
}

/**
 * Drops implausible years and sorts newest first. FIPE's 32000 means 0 km:
 * it stays, first, named "0 km Flex" instead of "32000 Flex".
 */
export function normalizeYearOptions(years: FipeOption[]): FipeOption[] {
  const latestPlausibleYear = new Date().getFullYear() + 1;
  const validYears = years
    .filter((item) => {
      const parsed = parseFipeYearCode(item.code);
      return (
        parsed !== null &&
        (parsed.modelYear === zeroKmModelYear ||
          (parsed.modelYear >= 1900 && parsed.modelYear <= latestPlausibleYear))
      );
    })
    .map((item) =>
      parseFipeYearCode(item.code)?.modelYear === zeroKmModelYear
        ? { ...item, name: item.name.replace(/^32000(?=\s|$)/, "0 km") }
        : item,
    );

  return validYears.sort((left, right) => {
    const leftYear = parseFipeYearCode(left.code)?.modelYear ?? 0;
    const rightYear = parseFipeYearCode(right.code)?.modelYear ?? 0;
    return rightYear - leftYear || left.name.localeCompare(right.name, "pt-BR");
  });
}

export function filterVehicles(
  vehicles: FipeVehicle[],
  filters: VehicleFilters,
): FipeVehicle[] {
  const query = filters.query.trim().toLocaleLowerCase("pt-BR");

  return vehicles.filter((vehicle) => {
    const matchesQuery =
      query.length === 0 ||
      `${vehicle.brand} ${vehicle.model} ${vehicle.codeFipe}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
    const matchesMin =
      filters.minPrice === null || vehicle.priceValue >= filters.minPrice;
    const matchesMax =
      filters.maxPrice === null || vehicle.priceValue <= filters.maxPrice;
    const matchesCategory =
      !filters.category ||
      filters.category === "all" ||
      vehicle.category === filters.category;
    const matchesBrand = !filters.brand || vehicle.brand === filters.brand;
    const matchesModel = !filters.model || vehicle.model === filters.model;
    const matchesYear =
      !filters.modelYear || vehicle.modelYear === filters.modelYear;

    return (
      matchesQuery &&
      matchesMin &&
      matchesMax &&
      matchesCategory &&
      matchesBrand &&
      matchesModel &&
      matchesYear
    );
  });
}

// FIPE API v2 (Parallelum), always through our proxy (server/fipe-proxy.ts):
// it holds the subscription token, so no key ever ships in the bundle. Every
// call goes through the shared HTTP client: timeout, typed errors and one
// cache per URL.

const apiBaseUrl = (import.meta.env.VITE_FIPE_API_URL?.trim() || "/api/fipe").replace(
  /\/+$/,
  "",
);
const requestCache = createRequestCache();

function fipeGet<T>(
  path: string,
  referenceCode: string | undefined,
  signal: AbortSignal | undefined,
): Promise<T> {
  const url =
    referenceCode === undefined
      ? `${apiBaseUrl}${path}`
      : `${apiBaseUrl}${path}?reference=${encodeURIComponent(referenceCode)}`;
  return requestCache.get(
    url,
    (requestSignal) => requestJson<T>("FIPE", url, { signal: requestSignal }),
    signal,
  );
}

const year = (yearCode: string) => encodeURIComponent(yearCode);

export function fetchReferences(signal?: AbortSignal): Promise<FipeReference[]> {
  return fipeGet("/references", undefined, signal);
}

export function fetchBrands(
  category: VehicleCategory,
  referenceCode: string,
  signal?: AbortSignal,
): Promise<FipeOption[]> {
  return fipeGet(`/${category}/brands`, referenceCode, signal);
}

export function fetchModels(
  category: VehicleCategory,
  brandCode: string,
  referenceCode: string,
  signal?: AbortSignal,
): Promise<FipeOption[]> {
  return fipeGet(`/${category}/brands/${brandCode}/models`, referenceCode, signal);
}

export async function fetchYearsByBrand(
  category: VehicleCategory,
  brandCode: string,
  referenceCode: string,
  signal?: AbortSignal,
): Promise<FipeOption[]> {
  const years = await fipeGet<FipeOption[]>(
    `/${category}/brands/${brandCode}/years`,
    referenceCode,
    signal,
  );
  return normalizeYearOptions([...years]);
}

export function fetchModelsByBrandYear(
  category: VehicleCategory,
  brandCode: string,
  yearCode: string,
  referenceCode: string,
  signal?: AbortSignal,
): Promise<FipeOption[]> {
  return fipeGet(
    `/${category}/brands/${brandCode}/years/${year(yearCode)}/models`,
    referenceCode,
    signal,
  );
}

export async function fetchYears(
  category: VehicleCategory,
  brandCode: string,
  modelCode: string,
  referenceCode: string,
  signal?: AbortSignal,
): Promise<FipeOption[]> {
  const years = await fipeGet<FipeOption[]>(
    `/${category}/brands/${brandCode}/models/${modelCode}/years`,
    referenceCode,
    signal,
  );
  return normalizeYearOptions([...years]);
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
  priceHistory?: FipePriceHistory[];
}

export async function fetchVehicleDetail(
  category: VehicleCategory,
  brandCode: string,
  modelCode: string,
  yearCode: string,
  referenceCode: string,
  signal?: AbortSignal,
): Promise<FipeVehicle> {
  const detail = await fipeGet<FipeDetail>(
    `/${category}/brands/${brandCode}/models/${modelCode}/years/${year(yearCode)}`,
    referenceCode,
    signal,
  );
  return toVehicle(detail, category, yearCode, referenceCode);
}

/** Accepts "001580-1" or "0015801"; null when it is not a FIPE code. */
export function normalizeFipeCode(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  return digits.length === 7 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : null;
}

export async function fetchYearsByFipeCode(
  category: VehicleCategory,
  fipeCode: string,
  referenceCode: string,
  signal?: AbortSignal,
): Promise<FipeOption[]> {
  const years = await fipeGet<FipeOption[]>(
    `/${category}/${fipeCode}/years`,
    referenceCode,
    signal,
  );
  return normalizeYearOptions([...years]);
}

export async function fetchVehicleByFipeCode(
  category: VehicleCategory,
  fipeCode: string,
  yearCode: string,
  referenceCode: string,
  signal?: AbortSignal,
): Promise<FipeVehicle> {
  const detail = await fipeGet<FipeDetail>(
    `/${category}/${fipeCode}/years/${year(yearCode)}`,
    referenceCode,
    signal,
  );
  return toVehicle(detail, category, yearCode, referenceCode);
}

function toVehicle(
  detail: FipeDetail,
  category: VehicleCategory,
  yearCode: string,
  referenceCode: string,
): FipeVehicle {
  return {
    id: `${category}:${referenceCode}:${detail.codeFipe}:${yearCode}`,
    category,
    yearCode,
    brand: detail.brand,
    model: detail.model,
    codeFipe: detail.codeFipe,
    fuel: detail.fuel,
    fuelAcronym: detail.fuelAcronym,
    modelYear: detail.modelYear,
    price: detail.price,
    priceValue: parseFipePrice(detail.price),
    referenceMonth: detail.referenceMonth,
    referenceCode,
  };
}

export async function fetchVehiclePriceHistory(
  category: VehicleCategory,
  fipeCode: string,
  yearCode: string,
  referenceCode: string,
  signal?: AbortSignal,
): Promise<FipePriceHistory[]> {
  const detail = await fipeGet<FipeDetail>(
    `/${category}/${fipeCode}/years/${year(yearCode)}/history`,
    referenceCode,
    signal,
  );
  return detail.priceHistory ?? [];
}
