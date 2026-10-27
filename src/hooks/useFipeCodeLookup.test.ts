// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fipe from "../services/fipe";
import { HttpError } from "../services/http";
import type { FipeVehicle } from "../types/vehicle";
import { invalidCodeMessage, notFoundMessage, useFipeCodeLookup } from "./useFipeCodeLookup";

vi.mock("../services/fipe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/fipe")>();
  return {
    ...actual,
    fetchYearsByFipeCode: vi.fn(),
    fetchVehicleByFipeCode: vi.fn(),
  };
});

const api = vi.mocked(fipe);
const notFound = new HttpError("http", "FIPE", "u", 404);
const truck = { codeFipe: "509003-4", model: "Constellation" } as FipeVehicle;
const years = [
  { code: "32000-3", name: "32000 Diesel" },
  { code: "2024-3", name: "2024 Diesel" },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchVehicleByFipeCode.mockResolvedValue(truck);
});

describe("useFipeCodeLookup", () => {
  it("finds the vehicle type with the code and asks for the year", async () => {
    api.fetchYearsByFipeCode.mockImplementation(async (category) => {
      if (category !== "trucks") throw notFound;
      return years;
    });
    const onVehicleLoaded = vi.fn();
    const { result } = renderHook(() => useFipeCodeLookup("338", onVehicleLoaded));

    act(() => result.current.submit("5090034", "cars"));
    expect(result.current).toMatchObject({ code: "509003-4", status: "loading" });
    await waitFor(() => expect(result.current.status).toBe("choose-year"));
    expect(result.current.category).toBe("trucks");
    expect(api.fetchYearsByFipeCode.mock.calls.map((call) => call[0])).toEqual([
      "cars",
      "motorcycles",
      "trucks",
    ]);

    act(() => result.current.chooseYear("2024-3"));
    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(api.fetchVehicleByFipeCode).toHaveBeenCalledWith(
      "trucks", "509003-4", "2024-3", "338", expect.any(AbortSignal),
    );
    expect(onVehicleLoaded).toHaveBeenCalledWith(truck);
  });

  it("loads directly when the code has a single year, without refetching", async () => {
    api.fetchYearsByFipeCode.mockResolvedValue([years[0]!]);
    const onVehicleLoaded = vi.fn();
    const { result } = renderHook(() => useFipeCodeLookup("338", onVehicleLoaded));

    act(() => result.current.submit("509003-4", "trucks"));
    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.year).toBe("32000-3");
    expect(api.fetchVehicleByFipeCode).toHaveBeenCalledTimes(1);
    expect(onVehicleLoaded).toHaveBeenCalledTimes(1);
  });

  it("restores a code and year from a link", async () => {
    api.fetchYearsByFipeCode.mockResolvedValue(years);
    const onVehicleLoaded = vi.fn();
    const { result } = renderHook(() =>
      useFipeCodeLookup("338", onVehicleLoaded, {
        code: "509003-4",
        year: "2024-3",
        category: "trucks",
      }),
    );

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(onVehicleLoaded).toHaveBeenCalledWith(truck));
    expect(result.current).toMatchObject({ year: "2024-3", status: "loaded" });
  });

  it("waits for the reference before looking up", async () => {
    api.fetchYearsByFipeCode.mockResolvedValue(years);
    const { result, rerender } = renderHook(
      ({ reference }) => useFipeCodeLookup(reference, vi.fn(), {
        code: "509003-4",
        year: "",
        category: "trucks",
      }),
      { initialProps: { reference: "" } },
    );

    expect(api.fetchYearsByFipeCode).not.toHaveBeenCalled();
    rerender({ reference: "338" });
    await waitFor(() => expect(result.current.status).toBe("choose-year"));
  });

  it("reports invalid, unknown and failing codes", async () => {
    const { result } = renderHook(() => useFipeCodeLookup("338", vi.fn()));

    act(() => result.current.submit("12-3", "cars"));
    expect(result.current).toMatchObject({ status: "error", error: invalidCodeMessage });
    expect(api.fetchYearsByFipeCode).not.toHaveBeenCalled();

    api.fetchYearsByFipeCode.mockRejectedValue(notFound);
    act(() => result.current.submit("000000-0", "cars"));
    await waitFor(() => expect(result.current.error).toBe(notFoundMessage));

    api.fetchYearsByFipeCode.mockRejectedValue(new HttpError("rate-limit", "FIPE", "u", 429));
    act(() => result.current.submit("001580-1", "cars"));
    await waitFor(() => expect(result.current.error).toMatch(/limite diário/));
    // A rate limit stops at the first type instead of trying the others.
    expect(api.fetchYearsByFipeCode).toHaveBeenLastCalledWith(
      "cars", "001580-1", "338", expect.any(AbortSignal),
    );

    act(() => result.current.clear());
    expect(result.current).toMatchObject({ status: "idle", code: "", error: "" });
  });
});
