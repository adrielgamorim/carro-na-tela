import { expandCatalogIndex } from "../../catalog/indexFormat";
import type { CatalogIndexFile } from "../../catalog/indexFormat";
import { brandShardPath } from "../../catalog/indexShards";
import type { Depreciation } from "../../catalog/depreciation";
import type { CatalogFleetInfo } from "../../catalog/fleet";
import type { InmetroSpec } from "../../catalog/inmetro";
import type { CatalogEntry, CatalogIndex } from "../../catalog/types";
import type { CatalogModelInfo } from "../../catalog/wikidata";
import { HttpError, requestJson } from "../http";
import type { Provider, VehicleRef } from "./types";

// The static catalog index (public/catalog/index.json), loaded once and shared
// by the catalog page and the providers that read from it. The Consulta FIPE
// loads only the slice of the vehicle's brand (public/catalog/marcas/), unless
// the whole index is already in memory.

const catalogUrl = `${import.meta.env.BASE_URL}catalog/`;
let indexPromise: Promise<CatalogIndex | null> | undefined;
const brandIndexes = new Map<string, Promise<CatalogIndex | null>>();

function loadIndexFile(path: string, timeoutMs: number, forget: () => void) {
  return requestJson<CatalogIndexFile>("Catálogo", catalogUrl + path, { timeoutMs })
    .then((file) => {
      if (file.version !== 2) {
        throw new Error("Formato de catálogo desatualizado: rode npm run build:catalog");
      }
      return expandCatalogIndex(file);
    })
    .catch((error: unknown) => {
      // Vite's dev server answers unknown paths with index.html (not JSON).
      if (
        error instanceof HttpError &&
        (error.status === 404 || error.kind === "parse")
      ) {
        return null;
      }
      forget();
      throw error;
    });
}

/** Resolves to null when the index was not generated yet. */
export function loadCatalogIndex(): Promise<CatalogIndex | null> {
  indexPromise ??= loadIndexFile("index.json", 30_000, () => {
    indexPromise = undefined;
  });
  return indexPromise;
}

/**
 * The part of the catalog with the vehicle's brand: the whole index when it
 * was loaded already, else the brand's slice. Null when the catalog has no
 * such brand (motorcycles and trucks, for now).
 */
export function loadCatalogIndexFor(
  vehicle: Pick<VehicleRef, "category" | "brand">,
): Promise<CatalogIndex | null> {
  if (indexPromise) return indexPromise;
  const path = brandShardPath(vehicle.category, vehicle.brand);
  let promise = brandIndexes.get(path);
  if (!promise) {
    promise = loadIndexFile(path, 15_000, () => brandIndexes.delete(path));
    brandIndexes.set(path, promise);
  }
  return promise;
}

/** Test hook: forget the loaded index and brand slices. */
export function resetCatalogIndex() {
  indexPromise = undefined;
  brandIndexes.clear();
}

const lookupKey = (brand: string, model: string, yearCode: string) =>
  `${brand}|${model.replace(/\s+/g, " ").trim()}|${yearCode}`.toLocaleLowerCase("pt-BR");

const entryMaps = new WeakMap<CatalogIndex, Map<string, CatalogEntry>>();

/**
 * Finds the catalog entry of a consulted vehicle. Both come from the same
 * FIPE API, so brand, model name and year code identify it exactly.
 */
export function findCatalogEntry(
  index: CatalogIndex,
  vehicle: VehicleRef,
): CatalogEntry | undefined {
  let entries = entryMaps.get(index);
  if (!entries) {
    entries = new Map();
    for (const entry of index.entries) {
      entries.set(lookupKey(entry.brand, entry.model, entry.yearCode), entry);
    }
    entryMaps.set(index, entries);
  }
  return entries.get(lookupKey(vehicle.brand, vehicle.model, vehicle.yearCode));
}

/** INMETRO PBEV data (size, consumption, transmission…) matched in the catalog. */
export function createInmetroProvider(
  loadIndex: (vehicle: VehicleRef) => Promise<CatalogIndex | null> = loadCatalogIndexFor,
): Provider<InmetroSpec> {
  return {
    id: "inmetro",
    async lookup(vehicle) {
      const index = await loadIndex(vehicle);
      const inmetro = index ? findCatalogEntry(index, vehicle)?.inmetro : null;
      return inmetro
        ? { source: "inmetro", confidence: inmetro.confidence, data: inmetro }
        : null;
    },
  };
}

export const inmetroProvider = createInmetroProvider();

/**
 * Picture and description of the model line from Wikidata. The year does not
 * matter (the match is per version), so any year of the version will do.
 */
export function createModelInfoProvider(
  loadIndex: (vehicle: VehicleRef) => Promise<CatalogIndex | null> = loadCatalogIndexFor,
): Provider<CatalogModelInfo> {
  return {
    id: "model",
    async lookup(vehicle) {
      const index = await loadIndex(vehicle);
      if (!index) return null;
      const entry =
        findCatalogEntry(index, vehicle) ??
        index.entries.find(
          (item) =>
            lookupKey(item.brand, item.model, "") === lookupKey(vehicle.brand, vehicle.model, ""),
        );
      return entry?.wikidata
        ? { source: "wikidata", confidence: "fuzzy", data: entry.wikidata }
        : null;
    },
  };
}

export const modelInfoProvider = createModelInfoProvider();

/**
 * Fleet in circulation of the vehicle's model line (Senatran). Counted per
 * line (brand + family), so any year of the version will do.
 */
export function createFleetProvider(
  loadIndex: (vehicle: VehicleRef) => Promise<CatalogIndex | null> = loadCatalogIndexFor,
): Provider<CatalogFleetInfo> {
  return {
    id: "fleet",
    async lookup(vehicle) {
      const index = await loadIndex(vehicle);
      if (!index) return null;
      const entry =
        findCatalogEntry(index, vehicle) ??
        index.entries.find(
          (item) =>
            lookupKey(item.brand, item.model, "") === lookupKey(vehicle.brand, vehicle.model, ""),
        );
      return entry?.fleet
        ? { source: "senatran", confidence: "fuzzy", data: entry.fleet }
        : null;
    },
  };
}

export const fleetProvider = createFleetProvider();

/** Average yearly depreciation of the version, from its prices in the catalog. */
export function createDepreciationProvider(
  loadIndex: (vehicle: VehicleRef) => Promise<CatalogIndex | null> = loadCatalogIndexFor,
): Provider<Depreciation> {
  return {
    id: "depreciation",
    async lookup(vehicle) {
      const index = await loadIndex(vehicle);
      const depreciation = index ? findCatalogEntry(index, vehicle)?.depreciation : null;
      return depreciation ? { source: "fipe", confidence: "exact", data: depreciation } : null;
    },
  };
}

export const depreciationProvider = createDepreciationProvider();
