import { useEffect, useState } from "react";
import type { CatalogEntry } from "../catalog/types";
import { findCatalogEntry, loadCatalogIndexFor } from "../services/providers/catalog";
import type { FipeVehicle } from "../types/vehicle";

/**
 * Catalog entries (INMETRO, frota…) of consulted vehicles, loading only the
 * slices of their brands. Vehicles not in the catalog, or whose slice failed
 * to load, have no entry: the table shows "—" for them.
 */
export function useCatalogEntries(
  vehicles: FipeVehicle[],
): (vehicle: FipeVehicle) => CatalogEntry | undefined {
  const [entries, setEntries] = useState<Map<string, CatalogEntry>>(() => new Map());
  const ids = vehicles.map((vehicle) => vehicle.id).join("\n");

  useEffect(() => {
    let active = true;
    Promise.all(
      vehicles.map((vehicle) =>
        loadCatalogIndexFor(vehicle)
          .then((index) => [vehicle.id, index && findCatalogEntry(index, vehicle)] as const)
          .catch(() => [vehicle.id, undefined] as const),
      ),
    ).then((found) => {
      if (!active) return;
      const next = new Map<string, CatalogEntry>();
      for (const [id, entry] of found) if (entry) next.set(id, entry);
      setEntries(next);
    });
    return () => {
      active = false;
    };
    // `ids` stands for `vehicles`: the list is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return (vehicle) => entries.get(vehicle.id);
}
