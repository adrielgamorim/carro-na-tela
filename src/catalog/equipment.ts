// Standard equipment by version (Renault's lists, npm run fichas:abertas), in
// public/catalog/equipamentos.json, loaded by the version page. The index
// only says, per version-year, which list is its own (WireVersion.q).

export interface EquipmentGroup {
  /** "Conforto e conveniência" */
  name: string;
  /** Standard items; optional ones end in "(opcional)". */
  items: string[];
}

export interface CatalogEquipment {
  /** "Logan · Zen 1.6 CVT" */
  title: string;
  /** The press room ("Renault") and its page of the line. */
  source: string;
  page: string;
  groups: EquipmentGroup[];
}

export interface EquipmentFileWire {
  lists: CatalogEquipment[];
}

/** Path of the lists, relative to the catalog folder. */
export const equipmentPath = "equipamentos.json";
