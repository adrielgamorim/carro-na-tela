import { useEffect, useState } from "react";
import type { CatalogIndex } from "../catalog/types";
import { requestErrorMessage } from "../services/errors";
import { loadCatalogIndex } from "../services/providers/catalog";

type CatalogIndexState =
  | { status: "loading" }
  | { status: "ready"; index: CatalogIndex }
  | { status: "missing" }
  | { status: "error"; message: string };

export function useCatalogIndex(): CatalogIndexState {
  const [state, setState] = useState<CatalogIndexState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    loadCatalogIndex()
      .then((index) => {
        if (!active) return;
        setState(index ? { status: "ready", index } : { status: "missing" });
      })
      .catch((cause: unknown) => {
        if (active) {
          setState({ status: "error", message: requestErrorMessage(cause) });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
