import type { Depreciation } from "../catalog/depreciation";
import type { CatalogFleetInfo } from "../catalog/fleet";
import type { InmetroSpec } from "../catalog/inmetro";
import type { CatalogModelInfo } from "../catalog/wikidata";
import type { ModelNameAttributes } from "../catalog/modelName";
import type { PressSpecs } from "../catalog/press";
import type { FipePriceHistory } from "../types/vehicle";
import { requestErrorMessage } from "./errors";
import { isAbortError } from "./http";
import {
  depreciationProvider,
  fleetProvider,
  inmetroProvider,
  modelInfoProvider,
  pressProvider,
} from "./providers/catalog";
import { fipeHistoryProvider } from "./providers/fipe";
import { modelNameProvider } from "./providers/modelName";
import type { Provider, ProviderResult, VehicleRef } from "./providers/types";

// Gathers everything known about a vehicle from every provider. Providers run
// in parallel and fail independently: one failing source leaves the others'
// data intact and is reported in `errors`, so it can be retried alone.

export interface VehicleEnrichment {
  history: ProviderResult<FipePriceHistory[]>;
  specs: ProviderResult<ModelNameAttributes>;
  inmetro: ProviderResult<InmetroSpec>;
  model: ProviderResult<CatalogModelInfo>;
  fleet: ProviderResult<CatalogFleetInfo>;
  depreciation: ProviderResult<Depreciation>;
  press: ProviderResult<PressSpecs>;
}

export type EnrichmentKey = keyof VehicleEnrichment;

export type EnrichmentProviders = {
  [K in EnrichmentKey]: Provider<VehicleEnrichment[K]["data"]>;
};

export const defaultProviders: EnrichmentProviders = {
  history: fipeHistoryProvider,
  specs: modelNameProvider,
  inmetro: inmetroProvider,
  model: modelInfoProvider,
  fleet: fleetProvider,
  depreciation: depreciationProvider,
  press: pressProvider,
};

export interface EnrichmentOutcome {
  /** Present for providers that had data; null when the source had none. */
  data: { [K in EnrichmentKey]?: VehicleEnrichment[K] | null };
  errors: Partial<Record<EnrichmentKey, string>>;
}

export interface EnrichOptions {
  providers?: EnrichmentProviders;
  /** Run only these providers (e.g. the ones that failed). */
  only?: EnrichmentKey[];
  signal?: AbortSignal;
}

export async function enrichVehicle(
  vehicle: VehicleRef,
  { providers = defaultProviders, only, signal }: EnrichOptions = {},
): Promise<EnrichmentOutcome> {
  const keys = only ?? (Object.keys(providers) as EnrichmentKey[]);
  const settled = await Promise.allSettled(
    keys.map((key) => providers[key].lookup(vehicle, signal)),
  );

  const outcome: EnrichmentOutcome = { data: {}, errors: {} };
  settled.forEach((result, index) => {
    const key = keys[index];
    if (key === undefined) return;
    if (result.status === "fulfilled") {
      (outcome.data as Record<EnrichmentKey, unknown>)[key] = result.value;
    } else if (!isAbortError(result.reason)) {
      outcome.errors[key] = requestErrorMessage(result.reason);
    }
  });
  return outcome;
}
