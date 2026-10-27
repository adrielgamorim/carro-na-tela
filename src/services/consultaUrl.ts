import type { VehicleCategory } from "../types/vehicle";

// The FIPE consultation in the URL, so a link reopens the same vehicle:
// ?tipo=trucks&referencia=337&marcaId=21&familia=ARGO&modeloId=11&anoId=2026-5
// or, for a lookup by FIPE code, ?fipe=001580-1&fipeAno=2026-5.
// Keys differ from the catalog filters, which share the same URL.

export interface ConsultaSelection {
  category: VehicleCategory;
  reference: string;
  brand: string;
  modelFamily: string;
  model: string;
  year: string;
  /** The year was picked before the model. */
  yearFirst: boolean;
  fipeCode: string;
  fipeYear: string;
}

const categories: VehicleCategory[] = ["cars", "motorcycles", "trucks"];
const idPattern = /^\d{1,6}$/;
const yearPattern = /^\d{4,5}-\d{1,2}$/;
const fipeCodePattern = /^\d{6}-\d$/;

export function readConsultaParams(params: URLSearchParams): ConsultaSelection {
  const valid = (key: string, pattern: RegExp) => {
    const value = params.get(key) ?? "";
    return pattern.test(value) ? value : "";
  };
  const category = params.get("tipo") as VehicleCategory | null;
  const reference = valid("referencia", idPattern);
  const brand = valid("marcaId", idPattern);
  const modelFamily = brand ? (params.get("familia") ?? "").trim() : "";
  const model = modelFamily ? valid("modeloId", idPattern) : "";
  const year = modelFamily ? valid("anoId", yearPattern) : "";
  const fipeCode = valid("fipe", fipeCodePattern);

  return {
    category: category && categories.includes(category) ? category : "cars",
    reference,
    brand,
    modelFamily,
    model,
    year,
    yearFirst: Boolean(year) && params.get("anoPrimeiro") === "1",
    fipeCode,
    fipeYear: fipeCode ? valid("fipeAno", yearPattern) : "",
  };
}

const consultaKeys = [
  "tipo",
  "referencia",
  "marcaId",
  "familia",
  "modeloId",
  "anoId",
  "anoPrimeiro",
  "fipe",
  "fipeAno",
];

/** Removes the consultation, e.g. while the catalog view owns the URL. */
export function clearConsultaParams(params: URLSearchParams): void {
  for (const key of consultaKeys) params.delete(key);
}

export function writeConsultaParams(
  selection: ConsultaSelection,
  params: URLSearchParams,
  /** The newest reference month; it is the default, so it stays out of the URL. */
  latestReference?: string,
): void {
  const set = (key: string, value: string | false) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };

  set("tipo", selection.category !== "cars" && selection.category);
  set(
    "referencia",
    selection.reference !== latestReference && selection.reference,
  );
  set("marcaId", selection.brand);
  set("familia", selection.brand && selection.modelFamily);
  set("modeloId", selection.modelFamily && selection.model);
  set("anoId", selection.modelFamily && selection.year);
  set("anoPrimeiro", selection.yearFirst && selection.year && "1");
  set("fipe", selection.fipeCode);
  set("fipeAno", selection.fipeCode && selection.fipeYear);
}
