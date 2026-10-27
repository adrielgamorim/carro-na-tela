import { useEffect, useEffectEvent, useReducer } from "react";
import { requestErrorMessage } from "../services/errors";
import {
  fetchBrands,
  fetchModels,
  fetchModelsByBrandYear,
  fetchReferences,
  fetchVehicleDetail,
  fetchYears,
  fetchYearsByBrand,
  filterModelsByFamily,
  getModelFamilies,
} from "../services/fipe";
import { isAbortError } from "../services/http";
import type { FipeVehicle, VehicleCategory } from "../types/vehicle";
import { catalogSteps, createFipeCatalogState, fipeCatalogReducer } from "./fipeCatalogState";
import type { CatalogStep, InitialSelection } from "./fipeCatalogState";

// The cascade's requests: each effect fetches one step and dispatches the
// result to the pure reducer in fipeCatalogState.ts.

export type { CatalogStep, FipeCatalogState } from "./fipeCatalogState";

export function useFipeCatalog(
  onVehicleLoaded: (vehicle: FipeVehicle) => void,
  initial?: InitialSelection,
) {
  const [state, dispatch] = useReducer(
    fipeCatalogReducer,
    initial,
    createFipeCatalogState,
  );
  const {
    references,
    reference,
    category,
    brands,
    models,
    years,
    brandYears,
    modelsForYear,
    brand,
    modelFamily,
    model,
    year,
    yearSelectionStarted,
    loading,
    errors,
    retries,
  } = state;
  const handleVehicleLoaded = useEffectEvent(onVehicleLoaded);

  /**
   * Runs one step's request and returns the effect cleanup, which aborts the
   * request (it is no longer needed once the selection changed).
   */
  function track<T>(
    step: CatalogStep,
    request: (signal: AbortSignal) => Promise<T>,
    onResult: (result: T) => void,
  ) {
    const controller = new AbortController();
    request(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) onResult(result);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || isAbortError(cause)) return;
        dispatch({ type: "failed", step, message: requestErrorMessage(cause) });
      })
      .finally(() => {
        if (!controller.signal.aborted) dispatch({ type: "settled", step });
      });
    return () => controller.abort();
  }

  useEffect(
    () =>
      track("references", (signal) => fetchReferences(signal), (items) =>
        dispatch({ type: "referencesLoaded", references: items }),
      ),
    [retries.references],
  );

  useEffect(() => {
    if (!reference) return;
    return track(
      "brands",
      (signal) => fetchBrands(category, reference, signal),
      (items) => dispatch({ type: "loaded", list: "brands", items }),
    );
  }, [category, reference, retries.brands]);

  useEffect(() => {
    if (!brand || !reference) return;
    return track(
      "models",
      (signal) => fetchModels(category, brand, reference, signal),
      (items) => dispatch({ type: "loaded", list: "models", items }),
    );
  }, [brand, category, reference, retries.models]);

  useEffect(() => {
    if (!brand || !reference) return;
    return track(
      "brandYears",
      (signal) => fetchYearsByBrand(category, brand, reference, signal),
      (items) => dispatch({ type: "loaded", list: "brandYears", items }),
    );
  }, [brand, category, reference, retries.brandYears]);

  useEffect(() => {
    if (!brand || !model || !reference || yearSelectionStarted) return;
    return track(
      "years",
      (signal) => fetchYears(category, brand, model, reference, signal),
      (items) => dispatch({ type: "loaded", list: "years", items }),
    );
  }, [brand, category, model, reference, retries.years, yearSelectionStarted]);

  useEffect(() => {
    if (!brand || !year || !reference || !yearSelectionStarted) return;
    return track(
      "modelsForYear",
      (signal) => fetchModelsByBrandYear(category, brand, year, reference, signal),
      (items) => dispatch({ type: "loaded", list: "modelsForYear", items }),
    );
  }, [brand, category, reference, retries.modelsForYear, year, yearSelectionStarted]);

  useEffect(() => {
    if (!brand || !model || !year || !reference) return;
    return track(
      "detail",
      (signal) => fetchVehicleDetail(category, brand, model, year, reference, signal),
      (vehicle) => handleVehicleLoaded(vehicle),
    );
  }, [brand, category, model, reference, retries.detail, year]);

  const referenceMonth = references.find(
    (item) => item.code === reference,
  )?.month;
  const modelOptions = yearSelectionStarted ? modelsForYear : models;
  const modelFamilies = getModelFamilies(models);
  const exactModels = modelFamily
    ? filterModelsByFamily(modelOptions, modelFamily)
    : [];
  const availableYears = model && !yearSelectionStarted ? years : brandYears;

  return {
    references,
    reference,
    referenceMonth,
    category,
    brands,
    brand,
    modelFamilies,
    modelFamily,
    exactModels,
    model,
    availableYears,
    year,
    yearSelectionStarted,
    loadingReferences: loading.references,
    loadingBrands: loading.brands,
    loadingModels: loading.models,
    loadingYears: loading.years,
    loadingBrandYears: loading.brandYears,
    loadingModelsForYear: loading.modelsForYear,
    loadingDetail: loading.detail,
    /** Failed steps in cascade order. */
    errors: catalogSteps
      .filter((step) => errors[step])
      .map((step) => ({ step, message: errors[step]! })),
    changeCategory: (next: VehicleCategory) =>
      dispatch({ type: "changeCategory", category: next }),
    changeReference: (next: string) =>
      dispatch({ type: "changeReference", reference: next }),
    changeBrand: (next: string) => dispatch({ type: "changeBrand", brand: next }),
    changeModelFamily: (next: string) =>
      dispatch({ type: "changeModelFamily", family: next }),
    changeModel: (next: string) => dispatch({ type: "changeModel", model: next }),
    changeYear: (next: string) => dispatch({ type: "changeYear", year: next }),
    retry: () => dispatch({ type: "retry" }),
    dismissError: () => dispatch({ type: "dismissError" }),
  };
}

export type FipeCatalog = ReturnType<typeof useFipeCatalog>;
