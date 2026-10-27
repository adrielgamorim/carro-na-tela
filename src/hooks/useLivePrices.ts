import { useState } from "react";
import type { CatalogEntry } from "../catalog/types";
import type { LivePrice } from "../components/catalog/CatalogCard";
import { requestErrorMessage } from "../services/errors";
import { fetchVehicleDetail } from "../services/fipe";

/** Prices fetched live from catalog cards whose version has no crawled price yet. */
export function useLivePrices() {
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({});

  function fetchPrice(entry: CatalogEntry) {
    const current = livePrices[entry.id];
    if (current?.status === "loading" || current?.status === "ready") return;

    setLivePrices((prices) => ({ ...prices, [entry.id]: { status: "loading" } }));
    fetchVehicleDetail(
      entry.category,
      entry.brandCode,
      entry.modelCode,
      entry.yearCode,
      entry.referenceCode,
    )
      .then((vehicle) => {
        setLivePrices((prices) => ({
          ...prices,
          [entry.id]: { status: "ready", vehicle },
        }));
      })
      .catch((cause: unknown) => {
        setLivePrices((prices) => ({
          ...prices,
          [entry.id]: { status: "error", message: requestErrorMessage(cause) },
        }));
      });
  }

  return { livePrices, fetchPrice };
}
