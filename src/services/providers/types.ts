import type { FipeVehicle } from "../../types/vehicle";

/** Where a piece of vehicle data came from. */
export type DataSource = "fipe" | "fipe-name" | "inmetro" | "wikidata" | "senatran";

/**
 * "exact" when the data belongs to this very version; "fuzzy" when it was
 * matched by name and may describe a close sibling version.
 */
export type Confidence = "exact" | "fuzzy";

/** Normalized result every provider returns. */
export interface ProviderResult<T> {
  source: DataSource;
  confidence: Confidence;
  data: T;
}

/** What providers need to identify a vehicle (a consulted FIPE vehicle fits). */
export type VehicleRef = Pick<
  FipeVehicle,
  "category" | "brand" | "model" | "codeFipe" | "yearCode" | "referenceCode"
>;

export interface Provider<T> {
  id: string;
  /** Resolves to null when the source has nothing for this vehicle. */
  lookup(vehicle: VehicleRef, signal?: AbortSignal): Promise<ProviderResult<T> | null>;
}
