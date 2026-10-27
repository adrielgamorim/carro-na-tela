// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fipe from "../services/fipe";
import { HttpError } from "../services/http";
import type { FipeVehicle } from "../types/vehicle";
import { useFipeCatalog } from "./useFipeCatalog";

vi.mock("../services/fipe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/fipe")>();
  return {
    ...actual,
    fetchReferences: vi.fn(),
    fetchBrands: vi.fn(),
    fetchModels: vi.fn(),
    fetchYearsByBrand: vi.fn(),
    fetchYears: vi.fn(),
    fetchModelsByBrandYear: vi.fn(),
    fetchVehicleDetail: vi.fn(),
  };
});

const api = vi.mocked(fipe);

const models = [
  { code: "10", name: "Siena EL 1.0" },
  { code: "11", name: "Siena Celebration 1.0 Fire Flex 8V 4p" },
  { code: "20", name: "Grand Siena 1.0 EVO Flex 8V 4p" },
];
const vehicle: FipeVehicle = {
  id: "cars:338:001-1:2012-5",
  category: "cars",
  yearCode: "2012-5",
  brand: "Fiat",
  model: "Siena Celebration 1.0 Fire Flex 8V 4p",
  codeFipe: "001-1",
  fuel: "Flex",
  fuelAcronym: "F",
  modelYear: 2012,
  price: "R$ 32.525,00",
  priceValue: 32525,
  referenceMonth: "outubro de 2026",
  referenceCode: "338",
};

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchReferences.mockResolvedValue([
    { code: "338", month: "outubro/2026" },
    { code: "337", month: "setembro/2026" },
  ]);
  api.fetchBrands.mockResolvedValue([{ code: "21", name: "Fiat" }]);
  api.fetchModels.mockResolvedValue(models);
  api.fetchYearsByBrand.mockResolvedValue([
    { code: "2016-3", name: "2016 Diesel" },
    { code: "2012-5", name: "2012 Flex" },
  ]);
  api.fetchYears.mockResolvedValue([{ code: "2012-5", name: "2012 Flex" }]);
  api.fetchModelsByBrandYear.mockResolvedValue([models[1]!]);
  api.fetchVehicleDetail.mockResolvedValue(vehicle);
});

async function renderReady() {
  const onVehicleLoaded = vi.fn();
  const hook = renderHook(() => useFipeCatalog(onVehicleLoaded));
  await waitFor(() => {
    expect(hook.result.current.loadingBrands).toBe(false);
    expect(hook.result.current.brands).toHaveLength(1);
  });
  return { ...hook, onVehicleLoaded };
}

async function selectBrandAndFamily(
  result: Awaited<ReturnType<typeof renderReady>>["result"],
  family: string,
) {
  act(() => result.current.changeBrand("21"));
  await waitFor(() => {
    expect(result.current.loadingModels).toBe(false);
    expect(result.current.loadingBrandYears).toBe(false);
  });
  act(() => result.current.changeModelFamily(family));
}

describe("useFipeCatalog", () => {
  it("loads references, selects the newest one and loads its brands", async () => {
    const { result } = await renderReady();

    expect(result.current.reference).toBe("338");
    expect(result.current.referenceMonth).toBe("outubro/2026");
    expect(result.current.loadingReferences).toBe(false);
    expect(api.fetchBrands).toHaveBeenCalledWith("cars", "338", expect.any(AbortSignal));
  });

  it("model first: family → model → year loads the vehicle", async () => {
    const { result, onVehicleLoaded } = await renderReady();
    await selectBrandAndFamily(result, "Siena");

    expect(result.current.modelFamilies).toEqual(["Siena", "Grand Siena"]);
    expect(result.current.exactModels.map((model) => model.code)).toEqual(["10", "11"]);
    // Before a model is picked, years come from the whole brand.
    expect(result.current.availableYears.map((year) => year.code)).toEqual([
      "2016-3",
      "2012-5",
    ]);

    act(() => result.current.changeModel("11"));
    expect(result.current.loadingYears).toBe(true);
    await waitFor(() => expect(result.current.loadingYears).toBe(false));
    expect(api.fetchYears).toHaveBeenCalledWith("cars", "21", "11", "338", expect.any(AbortSignal));
    expect(result.current.availableYears.map((year) => year.code)).toEqual(["2012-5"]);

    act(() => result.current.changeYear("2012-5"));
    expect(result.current.loadingDetail).toBe(true);
    await waitFor(() => expect(result.current.loadingDetail).toBe(false));
    expect(api.fetchVehicleDetail).toHaveBeenCalledWith("cars", "21", "11", "2012-5", "338", expect.any(AbortSignal));
    expect(onVehicleLoaded).toHaveBeenCalledWith(vehicle);
    expect(result.current.yearSelectionStarted).toBe(false);
  });

  it("year first: year → models of that year → model loads the vehicle", async () => {
    const { result, onVehicleLoaded } = await renderReady();
    await selectBrandAndFamily(result, "Siena");

    act(() => result.current.changeYear("2012-5"));
    expect(result.current.yearSelectionStarted).toBe(true);
    expect(result.current.loadingModelsForYear).toBe(true);
    await waitFor(() => expect(result.current.loadingModelsForYear).toBe(false));
    expect(api.fetchModelsByBrandYear).toHaveBeenCalledWith("cars", "21", "2012-5", "338", expect.any(AbortSignal));
    expect(result.current.exactModels.map((model) => model.code)).toEqual(["11"]);

    act(() => result.current.changeModel("11"));
    await waitFor(() => expect(onVehicleLoaded).toHaveBeenCalledWith(vehicle));
    expect(api.fetchYears).not.toHaveBeenCalled();
  });

  it("year first: picking another year clears the model", async () => {
    const { result } = await renderReady();
    await selectBrandAndFamily(result, "Siena");
    act(() => result.current.changeYear("2012-5"));
    await waitFor(() => expect(result.current.loadingModelsForYear).toBe(false));
    act(() => result.current.changeModel("11"));
    await waitFor(() => expect(result.current.loadingDetail).toBe(false));

    api.fetchModelsByBrandYear.mockResolvedValue([]);
    act(() => result.current.changeYear("2016-3"));
    expect(result.current.model).toBe("");
    await waitFor(() => expect(result.current.loadingModelsForYear).toBe(false));
    expect(result.current.exactModels).toEqual([]);

    act(() => result.current.changeYear(""));
    expect(result.current.yearSelectionStarted).toBe(false);
  });

  it("changing the family resets model and year", async () => {
    const { result } = await renderReady();
    await selectBrandAndFamily(result, "Siena");
    act(() => result.current.changeYear("2012-5"));
    await waitFor(() => expect(result.current.loadingModelsForYear).toBe(false));

    act(() => result.current.changeModelFamily("Grand Siena"));
    expect(result.current).toMatchObject({
      modelFamily: "Grand Siena",
      model: "",
      year: "",
      yearSelectionStarted: false,
    });
    expect(result.current.exactModels.map((model) => model.code)).toEqual(["20"]);
  });

  it("changing category or reference resets the selection and reloads brands", async () => {
    const { result } = await renderReady();
    await selectBrandAndFamily(result, "Siena");

    act(() => result.current.changeCategory("trucks"));
    expect(result.current).toMatchObject({
      category: "trucks",
      brand: "",
      modelFamily: "",
      brands: [],
      loadingBrands: true,
    });
    await waitFor(() => expect(result.current.loadingBrands).toBe(false));
    expect(api.fetchBrands).toHaveBeenLastCalledWith("trucks", "338", expect.any(AbortSignal));

    // Selecting the current category again does nothing.
    act(() => result.current.changeCategory("trucks"));
    expect(result.current.loadingBrands).toBe(false);

    act(() => result.current.changeReference("337"));
    expect(result.current.reference).toBe("337");
    await waitFor(() => expect(result.current.loadingBrands).toBe(false));
    expect(api.fetchBrands).toHaveBeenLastCalledWith("trucks", "337", expect.any(AbortSignal));
  });

  it("restores a shared selection, loading every step at once", async () => {
    const onVehicleLoaded = vi.fn();
    const { result } = renderHook(() =>
      useFipeCatalog(onVehicleLoaded, {
        reference: "337",
        brand: "21",
        modelFamily: "Siena",
        model: "11",
        year: "2012-5",
      }),
    );

    expect(result.current).toMatchObject({
      loadingBrands: true,
      loadingModels: true,
      loadingYears: true,
      loadingDetail: true,
    });
    await waitFor(() => expect(onVehicleLoaded).toHaveBeenCalledWith(vehicle));
    await waitFor(() => expect(result.current.loadingReferences).toBe(false));

    // The shared reference wins over the newest one, and nothing stays loading.
    expect(result.current.reference).toBe("337");
    expect(api.fetchVehicleDetail).toHaveBeenCalledWith(
      "cars", "21", "11", "2012-5", "337", expect.any(AbortSignal),
    );
    expect(result.current).toMatchObject({
      loadingBrands: false,
      loadingModels: false,
      loadingYears: false,
      loadingDetail: false,
      modelFamily: "Siena",
    });
    expect(result.current.exactModels.map((model) => model.code)).toEqual(["10", "11"]);
  });

  it("restores a selection whose link omits the (newest) reference", async () => {
    const onVehicleLoaded = vi.fn();
    const { result } = renderHook(() =>
      useFipeCatalog(onVehicleLoaded, {
        brand: "21",
        modelFamily: "Siena",
        model: "11",
        year: "2012-5",
      }),
    );

    expect(result.current.brand).toBe("21");
    expect(api.fetchModels).not.toHaveBeenCalled();
    await waitFor(() => expect(onVehicleLoaded).toHaveBeenCalledWith(vehicle));
    expect(result.current.reference).toBe("338");
    await waitFor(() => expect(result.current.loadingDetail).toBe(false));
    expect(result.current).toMatchObject({
      brand: "21",
      modelFamily: "Siena",
      model: "11",
      year: "2012-5",
      loadingModels: false,
      loadingBrands: false,
    });
  });

  it("restores a year-first selection and falls back to the newest reference", async () => {
    const { result } = renderHook(() =>
      useFipeCatalog(vi.fn(), {
        reference: "999",
        brand: "21",
        modelFamily: "Siena",
        year: "2012-5",
        yearFirst: true,
      }),
    );

    await waitFor(() => expect(result.current.reference).toBe("338"));
    await waitFor(() => expect(result.current.loadingModelsForYear).toBe(false));
    expect(result.current.yearSelectionStarted).toBe(true);
    expect(api.fetchYears).not.toHaveBeenCalled();
  });

  it("reports errors per step and retries only the failed step", async () => {
    const { result } = await renderReady();
    api.fetchModels.mockRejectedValueOnce(new HttpError("timeout", "FIPE", "u"));

    act(() => result.current.changeBrand("21"));
    await waitFor(() => expect(result.current.loadingModels).toBe(false));
    await waitFor(() => expect(result.current.loadingBrandYears).toBe(false));

    // Years of the brand still loaded; only the models step failed.
    expect(result.current.errors).toEqual([
      {
        step: "models",
        message: "A FIPE demorou demais para responder. Tente novamente.",
      },
    ]);
    expect(result.current.availableYears).toHaveLength(2);
    const calls = {
      references: api.fetchReferences.mock.calls.length,
      brands: api.fetchBrands.mock.calls.length,
      brandYears: api.fetchYearsByBrand.mock.calls.length,
    };

    act(() => result.current.retry());
    expect(result.current.errors).toEqual([]);
    expect(result.current.loadingModels).toBe(true);
    expect(result.current.loadingBrandYears).toBe(false);
    await waitFor(() => expect(result.current.modelFamilies).toEqual(["Siena", "Grand Siena"]));
    expect(api.fetchReferences.mock.calls.length).toBe(calls.references);
    expect(api.fetchBrands.mock.calls.length).toBe(calls.brands);
    expect(api.fetchYearsByBrand.mock.calls.length).toBe(calls.brandYears);
  });

  it("keeps errors of several steps apart and shows rate limits", async () => {
    api.fetchModels.mockRejectedValueOnce(new HttpError("rate-limit", "FIPE", "u", 429));
    api.fetchYearsByBrand.mockRejectedValueOnce(new HttpError("network", "FIPE", "u"));
    const { result } = await renderReady();

    act(() => result.current.changeBrand("21"));
    await waitFor(() => expect(result.current.errors).toHaveLength(2));
    expect(result.current.errors).toEqual([
      {
        step: "models",
        message: "O limite diário de consultas foi atingido. Tente novamente mais tarde.",
      },
      {
        step: "brandYears",
        message: "Não foi possível conectar à FIPE. Verifique a conexão e tente novamente.",
      },
    ]);

    // Picking another brand drops the errors of the steps it reloads.
    act(() => result.current.changeBrand(""));
    expect(result.current.errors).toEqual([]);
  });

  it("retries a failed reference load", async () => {
    api.fetchReferences.mockRejectedValueOnce(new HttpError("http", "FIPE", "u", 503));
    const { result } = renderHook(() => useFipeCatalog(vi.fn()));

    await waitFor(() =>
      expect(result.current.errors).toEqual([
        {
          step: "references",
          message: "A FIPE está instável no momento. Tente novamente em instantes.",
        },
      ]),
    );
    expect(api.fetchBrands).not.toHaveBeenCalled();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.brands).toHaveLength(1));
    expect(result.current.errors).toEqual([]);
  });

  it("dismisses errors", async () => {
    api.fetchBrands.mockRejectedValueOnce(new HttpError("network", "FIPE", "u"));
    const { result } = renderHook(() => useFipeCatalog(vi.fn()));

    await waitFor(() => expect(result.current.errors).toHaveLength(1));
    act(() => result.current.dismissError());
    expect(result.current.errors).toEqual([]);
  });

  it("aborts requests that are no longer needed and ignores their errors", async () => {
    const { result } = await renderReady();
    let signal: AbortSignal | undefined;
    api.fetchModels.mockImplementationOnce((_category, _brand, _reference, requestSignal) => {
      signal = requestSignal;
      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () =>
          reject(new HttpError("aborted", "FIPE", "u")),
        );
      });
    });

    act(() => result.current.changeBrand("21"));
    expect(signal?.aborted).toBe(false);
    act(() => result.current.changeBrand(""));
    expect(signal?.aborted).toBe(true);
    await act(async () => {});
    expect(result.current.errors).toEqual([]);
  });

  it("ignores responses that arrive after the selection changed", async () => {
    const { result } = await renderReady();
    let resolveFirst: (value: typeof models) => void = () => {};
    api.fetchModels.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    api.fetchBrands.mockResolvedValue([
      { code: "21", name: "Fiat" },
      { code: "22", name: "Ford" },
    ]);

    act(() => result.current.changeBrand("21"));
    act(() => result.current.changeBrand(""));
    await act(async () => resolveFirst(models));

    expect(result.current.modelFamilies).toEqual([]);
  });
});
