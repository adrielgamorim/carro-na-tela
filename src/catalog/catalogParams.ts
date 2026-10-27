import type { ListFacet, ToggleFacet } from "./filters";

// Names of the catalog filters in the URL, apart from the filter logic so the
// app shell can clear them without loading the catalog's code.

export const listParams: Record<ListFacet, string> = {
  brands: "marca",
  families: "linha",
  sublines: "sublinha",
  propulsions: "propulsao",
  fuels: "combustivel",
  transmissions: "cambio",
  bodies: "carroceria",
  doors: "portas",
  sizes: "porte",
  gears: "marchas",
  steerings: "direcao",
  origins: "procedencia",
};
export const toggleParams: Record<ToggleFacet, string> = {
  zeroKmOnly: "zerokm",
  turbo: "turbo",
  fourWheelDrive: "4x4",
  airConditioning: "ar",
};

/** Every URL key the catalog filters use (see writeCatalogParams). */
export const catalogParamKeys = [
  "q",
  ...Object.values(listParams),
  ...Object.values(toggleParams),
  "ano",
  "preco",
  "motor",
  "consumo",
  "ordem",
  // The version open in the details dialog (CatalogPage).
  "versao",
];

/** Removes the catalog filters, e.g. while the consultation view owns the URL. */
export function clearCatalogParams(params: URLSearchParams): void {
  for (const key of catalogParamKeys) params.delete(key);
}
