import { useEffect, useState } from "react";
import { priceHistoryPath } from "../catalog/priceHistory";
import type { PriceHistoryFile } from "../catalog/priceHistory";
import { requestJson } from "../services/http";

// The kept FIPE prices of a brand (public/catalog/historico), loaded once per
// file. A file that fails to load only leaves the page with the API's 3 months.

const files = new Map<string, Promise<PriceHistoryFile | null>>();

function loadHistory(path: string): Promise<PriceHistoryFile | null> {
  let promise = files.get(path);
  if (!promise) {
    promise = requestJson<PriceHistoryFile>("Histórico de preços", `${import.meta.env.BASE_URL}catalog/${path}`, {
      timeoutMs: 15_000,
    }).catch(() => {
      files.delete(path);
      return null;
    });
    files.set(path, promise);
  }
  return promise;
}

/** The brand's kept price history for a catalog version-year, null until loaded. */
export function usePriceHistory(category: string, id: string): PriceHistoryFile | null {
  const path = priceHistoryPath(category, id);
  const [loaded, setLoaded] = useState<{ path: string; file: PriceHistoryFile | null } | null>(null);

  useEffect(() => {
    let active = true;
    void loadHistory(path).then((file) => {
      if (active) setLoaded({ path, file });
    });
    return () => {
      active = false;
    };
  }, [path]);

  return loaded && loaded.path === path ? loaded.file : null;
}
