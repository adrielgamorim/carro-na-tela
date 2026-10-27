import type { FipeOption, FipeReference } from "../services/fipe";
import type { VehicleCategory } from "../types/vehicle";

// Cascading FIPE selection: Referência → Marca → Linha → Modelo ↔ Ano.
// The year may be picked before the model; `yearSelectionStarted` tracks that mode.
// Each request is a step with its own loading flag, error and retry counter,
// so a failure in one step neither hides nor re-runs the others.

type OptionList = "brands" | "models" | "years" | "brandYears" | "modelsForYear";
export type CatalogStep = OptionList | "references" | "detail";

export const catalogSteps: CatalogStep[] = [
  "references",
  "brands",
  "models",
  "brandYears",
  "years",
  "modelsForYear",
  "detail",
];

export interface FipeCatalogState {
  references: FipeReference[];
  reference: string;
  category: VehicleCategory;
  brands: FipeOption[];
  models: FipeOption[];
  years: FipeOption[];
  brandYears: FipeOption[];
  modelsForYear: FipeOption[];
  brand: string;
  modelFamily: string;
  model: string;
  year: string;
  yearSelectionStarted: boolean;
  loading: Record<CatalogStep, boolean>;
  errors: Partial<Record<CatalogStep, string>>;
  /** Bumped per step by retry to re-run only that step's request. */
  retries: Record<CatalogStep, number>;
}

export type FipeCatalogAction =
  | { type: "referencesLoaded"; references: FipeReference[] }
  | { type: "loaded"; list: OptionList; items: FipeOption[] }
  | { type: "settled"; step: CatalogStep }
  | { type: "failed"; step: CatalogStep; message: string }
  | { type: "changeCategory"; category: VehicleCategory }
  | { type: "changeReference"; reference: string }
  | { type: "changeBrand"; brand: string }
  | { type: "changeModelFamily"; family: string }
  | { type: "changeModel"; model: string }
  | { type: "changeYear"; year: string }
  | { type: "retry" }
  | { type: "dismissError" };

const idle: Record<CatalogStep, boolean> = {
  references: false,
  brands: false,
  models: false,
  years: false,
  brandYears: false,
  modelsForYear: false,
  detail: false,
};

export const initialFipeCatalogState: FipeCatalogState = {
  references: [],
  reference: "",
  category: "cars",
  brands: [],
  models: [],
  years: [],
  brandYears: [],
  modelsForYear: [],
  brand: "",
  modelFamily: "",
  model: "",
  year: "",
  yearSelectionStarted: false,
  loading: { ...idle, references: true },
  errors: {},
  retries: {
    references: 0,
    brands: 0,
    models: 0,
    years: 0,
    brandYears: 0,
    modelsForYear: 0,
    detail: 0,
  },
};

function clearErrors(
  errors: FipeCatalogState["errors"],
  steps: CatalogStep[],
): FipeCatalogState["errors"] {
  const next = { ...errors };
  for (const step of steps) delete next[step];
  return next;
}

const belowBrands: CatalogStep[] = [
  "models",
  "years",
  "brandYears",
  "modelsForYear",
  "detail",
];

/** Clears everything below the brand list (used by category/reference changes). */
function withoutSelection(state: FipeCatalogState): FipeCatalogState {
  return {
    ...state,
    brand: "",
    modelFamily: "",
    model: "",
    year: "",
    yearSelectionStarted: false,
    models: [],
    years: [],
    brandYears: [],
    modelsForYear: [],
    errors: clearErrors(state.errors, ["brands", ...belowBrands]),
    loading: {
      ...state.loading,
      models: false,
      years: false,
      brandYears: false,
      modelsForYear: false,
      detail: false,
    },
  };
}

function changeYear(state: FipeCatalogState, year: string): FipeCatalogState {
  const next = {
    ...state,
    year,
    errors: clearErrors(state.errors, ["modelsForYear", "detail"]),
  };

  if (state.yearSelectionStarted && year) {
    // A different year invalidates the model chosen for the previous one.
    const yearChanged = year !== state.year;
    return {
      ...next,
      ...(yearChanged && { model: "", modelsForYear: [] }),
      loading: {
        ...state.loading,
        ...(yearChanged && { modelsForYear: true }),
        detail: false,
      },
    };
  }
  if (!state.model && year) {
    return {
      ...next,
      yearSelectionStarted: true,
      modelsForYear: [],
      loading: { ...state.loading, modelsForYear: true },
    };
  }
  if (!year) {
    return {
      ...next,
      yearSelectionStarted: false,
      modelsForYear: [],
      loading: { ...state.loading, modelsForYear: false, detail: false },
    };
  }
  return { ...next, loading: { ...state.loading, detail: Boolean(state.model) } };
}

/** Whether a step's request runs for the current selection (mirrors the effects). */
function stepRuns(state: FipeCatalogState, step: CatalogStep): boolean {
  const { brand, model, year, reference, yearSelectionStarted } = state;
  switch (step) {
    case "references":
      return true;
    case "brands":
      return Boolean(reference);
    case "models":
    case "brandYears":
      return Boolean(brand && reference);
    case "years":
      return Boolean(brand && model && reference && !yearSelectionStarted);
    case "modelsForYear":
      return Boolean(brand && year && reference && yearSelectionStarted);
    case "detail":
      return Boolean(brand && model && year && reference);
  }
}

export function fipeCatalogReducer(
  state: FipeCatalogState,
  action: FipeCatalogAction,
): FipeCatalogState {
  switch (action.type) {
    case "referencesLoaded": {
      // A reference restored from a link wins when it still exists.
      const reference = action.references.some((item) => item.code === state.reference)
        ? state.reference
        : (action.references[0]?.code ?? "");
      const next = {
        ...state,
        references: action.references,
        reference,
        errors: clearErrors(state.errors, ["references"]),
      };
      if (reference === state.reference) return next;
      // The reference just arrived (or a shared one was replaced): every step
      // the current selection implies starts now.
      const loading = { ...next.loading };
      for (const step of catalogSteps) {
        if (step !== "references") loading[step] = stepRuns(next, step);
      }
      return { ...next, loading };
    }
    case "loaded":
      return {
        ...state,
        [action.list]: action.items,
        errors: clearErrors(state.errors, [action.list]),
      };
    case "settled":
      return { ...state, loading: { ...state.loading, [action.step]: false } };
    case "failed":
      return { ...state, errors: { ...state.errors, [action.step]: action.message } };

    case "changeCategory": {
      if (state.category === action.category) return state;
      const cleared = withoutSelection(state);
      return {
        ...cleared,
        category: action.category,
        brands: [],
        loading: { ...cleared.loading, brands: true },
      };
    }
    case "changeReference": {
      const cleared = withoutSelection(state);
      return {
        ...cleared,
        reference: action.reference,
        brands: [],
        loading: { ...cleared.loading, brands: Boolean(action.reference) },
      };
    }
    case "changeBrand":
      return {
        ...state,
        brand: action.brand,
        modelFamily: "",
        model: "",
        year: "",
        yearSelectionStarted: false,
        models: [],
        years: [],
        brandYears: [],
        modelsForYear: [],
        errors: clearErrors(state.errors, belowBrands),
        loading: {
          ...state.loading,
          models: Boolean(action.brand),
          years: false,
          brandYears: Boolean(action.brand),
          modelsForYear: false,
          detail: false,
        },
      };
    case "changeModelFamily":
      return {
        ...state,
        modelFamily: action.family,
        model: "",
        year: "",
        yearSelectionStarted: false,
        years: [],
        modelsForYear: [],
        errors: clearErrors(state.errors, ["years", "modelsForYear", "detail"]),
        loading: {
          ...state.loading,
          years: false,
          modelsForYear: false,
          detail: false,
        },
      };
    case "changeModel":
      return {
        ...state,
        model: action.model,
        // Model first: picking a model restarts the year choice.
        ...(!state.yearSelectionStarted && { year: "", years: [] }),
        errors: clearErrors(state.errors, ["years", "detail"]),
        loading: {
          ...state.loading,
          ...(!state.yearSelectionStarted && { years: Boolean(action.model) }),
          detail: Boolean(action.model && state.year),
        },
      };
    case "changeYear":
      return changeYear(state, action.year);

    case "retry": {
      // Only the steps that failed run again.
      const failed = (Object.keys(state.errors) as CatalogStep[]).filter((step) =>
        stepRuns(state, step),
      );
      const retries = { ...state.retries };
      const loading = { ...state.loading };
      for (const step of failed) {
        retries[step] += 1;
        loading[step] = true;
      }
      return { ...state, errors: {}, retries, loading };
    }
    case "dismissError":
      return { ...state, errors: {} };
  }
}

export type InitialSelection = Partial<
  Pick<FipeCatalogState, "category" | "reference" | "brand" | "modelFamily" | "model" | "year">
> & { yearFirst?: boolean };

/**
 * State for a selection restored from a link: every step it implies starts
 * loading at once instead of waiting for the one above it.
 */
export function createFipeCatalogState(initial: InitialSelection = {}): FipeCatalogState {
  const category = initial.category ?? "cars";
  // Without a reference (links omit the newest one) the selection waits for
  // the reference list; its requests start in "referencesLoaded".
  const reference = initial.reference ?? "";
  const brand = initial.brand ?? "";
  const modelFamily = brand ? (initial.modelFamily ?? "") : "";
  const model = modelFamily ? (initial.model ?? "") : "";
  const year = modelFamily ? (initial.year ?? "") : "";
  const yearSelectionStarted = Boolean(year && initial.yearFirst);
  const state: FipeCatalogState = {
    ...initialFipeCatalogState,
    category,
    reference,
    brand,
    modelFamily,
    model,
    year,
    yearSelectionStarted,
  };
  return {
    ...state,
    loading: {
      references: true,
      brands: stepRuns(state, "brands"),
      models: stepRuns(state, "models"),
      brandYears: stepRuns(state, "brandYears"),
      years: stepRuns(state, "years"),
      modelsForYear: stepRuns(state, "modelsForYear"),
      detail: stepRuns(state, "detail"),
    },
  };
}
