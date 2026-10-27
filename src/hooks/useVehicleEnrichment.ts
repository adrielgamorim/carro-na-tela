import { useState } from "react";
import { enrichVehicle } from "../services/enrichment";
import type { EnrichmentKey, EnrichmentOutcome } from "../services/enrichment";
import type { FipeVehicle } from "../types/vehicle";

export type VehicleEnrichmentState = {
  status: "loading" | "loaded";
} & EnrichmentOutcome;

/** Loads on demand everything the providers know about consulted vehicles. */
export function useVehicleEnrichment() {
  const [byVehicle, setByVehicle] = useState<Record<string, VehicleEnrichmentState>>({});

  function run(vehicle: FipeVehicle, only?: EnrichmentKey[]) {
    setByVehicle((current) => ({
      ...current,
      [vehicle.id]: {
        data: current[vehicle.id]?.data ?? {},
        errors: {},
        status: "loading",
      },
    }));

    enrichVehicle(vehicle, { only }).then((outcome) => {
      setByVehicle((current) => ({
        ...current,
        [vehicle.id]: {
          status: "loaded",
          // A retry keeps what the other providers already returned.
          data: { ...current[vehicle.id]?.data, ...outcome.data },
          errors: outcome.errors,
        },
      }));
    });
  }

  /** First load; does nothing if the vehicle is loading or already loaded. */
  function load(vehicle: FipeVehicle) {
    if (!byVehicle[vehicle.id]) run(vehicle);
  }

  /** Re-runs only the providers that failed for this vehicle. */
  function retry(vehicle: FipeVehicle) {
    const failed = Object.keys(byVehicle[vehicle.id]?.errors ?? {}) as EnrichmentKey[];
    if (failed.length > 0) run(vehicle, failed);
  }

  return { enrichmentByVehicle: byVehicle, loadEnrichment: load, retryEnrichment: retry };
}
