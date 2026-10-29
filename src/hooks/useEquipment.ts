import { useEffect, useState } from "react";
import { equipmentPath } from "../catalog/equipment";
import type { CatalogEquipment, EquipmentFileWire } from "../catalog/equipment";
import { requestJson } from "../services/http";

// The equipment lists (public/catalog/equipamentos.json), loaded once, when a
// version page first needs one. A failed load only leaves the page without them.

let lists: Promise<CatalogEquipment[]> | undefined;

function loadLists(): Promise<CatalogEquipment[]> {
  lists ??= requestJson<EquipmentFileWire>("Equipamentos", `${import.meta.env.BASE_URL}catalog/${equipmentPath}`, {
    timeoutMs: 15_000,
  })
    .then((file) => file.lists)
    .catch(() => {
      lists = undefined;
      return [];
    });
  return lists;
}

/** A version-year's equipment list, undefined until loaded (or when it has none). */
export function useEquipment(index: number | undefined): CatalogEquipment | undefined {
  const [loaded, setLoaded] = useState<{ index: number; list: CatalogEquipment | undefined } | null>(null);

  useEffect(() => {
    if (index === undefined) return;
    let active = true;
    void loadLists().then((all) => {
      if (active) setLoaded({ index, list: all[index] });
    });
    return () => {
      active = false;
    };
  }, [index]);

  return loaded && loaded.index === index ? loaded.list : undefined;
}
