import { useEffect, useEffectEvent, useState } from "react";
import { categories } from "../constants/categories";
import { requestErrorMessage } from "../services/errors";
import {
  fetchVehicleByFipeCode,
  fetchYearsByFipeCode,
  normalizeFipeCode,
} from "../services/fipe";
import type { FipeOption } from "../services/fipe";
import { HttpError, isAbortError } from "../services/http";
import type { FipeVehicle, VehicleCategory } from "../types/vehicle";

// Direct lookup by FIPE code ("001580-1"): find the vehicle type that has the
// code, list its model years, then load the chosen year. The request lives in
// state and an effect performs it, so a code restored from a link works the
// same way as one typed in.

interface LookupRequest {
  code: string;
  /** Tried first; the other vehicle types follow on a 404. */
  preferredCategory: VehicleCategory;
  year: string;
}

export interface FipeCodeLookupState {
  /** What to look up; replaced (never mutated) by submit and chooseYear. */
  request: LookupRequest | null;
  /** Year actually loaded (the only one, when the code has a single year). */
  resolvedYear: string;
  status: "idle" | "loading" | "choose-year" | "loaded" | "error";
  category: VehicleCategory | null;
  years: FipeOption[];
  error: string;
}

const idle: FipeCodeLookupState = {
  request: null,
  resolvedYear: "",
  status: "idle",
  category: null,
  years: [],
  error: "",
};

export const notFoundMessage =
  "Código FIPE não encontrado em carros, motos ou caminhões nesta referência.";
export const invalidCodeMessage = "Digite um código FIPE com 7 dígitos, como 001580-1.";

async function findYears(
  code: string,
  preferred: VehicleCategory,
  reference: string,
  signal: AbortSignal,
): Promise<{ category: VehicleCategory; years: FipeOption[] } | null> {
  const order = [preferred, ...categories.map((item) => item.id).filter((id) => id !== preferred)];
  for (const category of order) {
    try {
      const years = await fetchYearsByFipeCode(category, code, reference, signal);
      if (years.length > 0) return { category, years };
    } catch (error) {
      if (!(error instanceof HttpError && error.kind === "http" && error.status === 404)) {
        throw error;
      }
    }
  }
  return null;
}

export function useFipeCodeLookup(
  reference: string,
  onVehicleLoaded: (vehicle: FipeVehicle) => void,
  initial?: { code: string; year: string; category: VehicleCategory },
) {
  const [state, setState] = useState<FipeCodeLookupState>(() => ({
    request: initial?.code
      ? { code: initial.code, year: initial.year, preferredCategory: initial.category }
      : null,
    resolvedYear: "",
    status: initial?.code ? "loading" : "idle",
    category: null,
    years: [],
    error: "",
  }));
  const handleVehicleLoaded = useEffectEvent(onVehicleLoaded);
  const { request } = state;

  useEffect(() => {
    if (!request || !reference) return;
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      const found = await findYears(request.code, request.preferredCategory, reference, signal);
      if (signal.aborted) return;
      if (!found) {
        setState((current) => ({ ...current, status: "error", years: [], error: notFoundMessage }));
        return;
      }
      const year =
        request.year && found.years.some((item) => item.code === request.year)
          ? request.year
          : found.years.length === 1
            ? (found.years[0]?.code ?? "")
            : "";
      if (!year) {
        setState((current) => ({
          ...current,
          status: "choose-year",
          category: found.category,
          years: found.years,
        }));
        return;
      }
      const vehicle = await fetchVehicleByFipeCode(
        found.category,
        request.code,
        year,
        reference,
        signal,
      );
      if (signal.aborted) return;
      handleVehicleLoaded(vehicle);
      setState((current) => ({
        ...current,
        resolvedYear: year,
        status: "loaded",
        category: found.category,
        years: found.years,
      }));
    })().catch((error: unknown) => {
      if (signal.aborted || isAbortError(error)) return;
      setState((current) => ({ ...current, status: "error", error: requestErrorMessage(error) }));
    });

    return () => controller.abort();
  }, [request, reference]);

  /** Starts a lookup; `category` is tried first. */
  function submit(text: string, category: VehicleCategory) {
    const code = normalizeFipeCode(text);
    if (!code) {
      setState({ ...idle, status: "error", error: invalidCodeMessage });
      return;
    }
    setState({
      ...idle,
      request: { code, year: "", preferredCategory: category },
      status: "loading",
    });
  }

  function chooseYear(year: string) {
    setState((current) =>
      current.request
        ? {
            ...current,
            request: { ...current.request, year },
            resolvedYear: "",
            status: year ? "loading" : "choose-year",
          }
        : current,
    );
  }

  function clear() {
    setState(idle);
  }

  return {
    code: request?.code ?? "",
    year: state.resolvedYear || request?.year || "",
    category: state.category,
    years: state.years,
    status: state.status,
    error: state.error,
    submit,
    chooseYear,
    clear,
  };
}

export type FipeCodeLookup = ReturnType<typeof useFipeCodeLookup>;
