import { describe, expect, it, vi } from "vitest";
import type { InmetroSpec } from "../catalog/inmetro";
import type { CatalogIndex } from "../catalog/types";
import { enrichVehicle } from "./enrichment";
import type { EnrichmentProviders } from "./enrichment";
import { HttpError } from "./http";
import { createInmetroProvider, createModelInfoProvider, findCatalogEntry } from "./providers/catalog";
import { modelNameProvider } from "./providers/modelName";
import type { VehicleRef } from "./providers/types";

const vehicle: VehicleRef = {
  category: "cars",
  brand: "Fiat",
  model: "ARGO DRIVE 1.3 8V Flex Aut.",
  codeFipe: "001-1",
  yearCode: "2026-5",
  referenceCode: "338",
};

const spec = { version: "DRIVE 1.3 AT", confidence: "fuzzy" } as InmetroSpec;

function providers(overrides: Partial<EnrichmentProviders> = {}): EnrichmentProviders {
  return {
    history: {
      id: "history",
      lookup: vi.fn(async () => ({
        source: "fipe" as const,
        confidence: "exact" as const,
        data: [{ month: "outubro de 2026", price: "R$ 1,00", reference: "338" }],
      })),
    },
    specs: modelNameProvider,
    inmetro: { id: "inmetro", lookup: vi.fn(async () => null) },
    model: { id: "model", lookup: vi.fn(async () => null) },
    fleet: { id: "fleet", lookup: vi.fn(async () => null) },
    depreciation: { id: "depreciation", lookup: vi.fn(async () => null) },
    press: { id: "press", lookup: vi.fn(async () => null) },
    ...overrides,
  };
}

describe("enrichVehicle", () => {
  it("normalizes every provider result", async () => {
    const { data, errors } = await enrichVehicle(vehicle, { providers: providers() });

    expect(errors).toEqual({});
    expect(data.history).toMatchObject({ source: "fipe", confidence: "exact" });
    expect(data.specs).toEqual({
      source: "fipe-name",
      confidence: "exact",
      data: { engineLiters: 1.3, valves: 8, fuel: "flex", transmission: "automatico" },
    });
    expect(data.inmetro).toBeNull();
  });

  it("isolates a failing provider and reports a friendly message", async () => {
    const failing = providers({
      history: {
        id: "history",
        lookup: vi.fn(async () => {
          throw new HttpError("rate-limit", "FIPE", "u", 429);
        }),
      },
    });
    const { data, errors } = await enrichVehicle(vehicle, { providers: failing });

    expect(errors).toEqual({
      history: "O limite diário de consultas foi atingido. Tente novamente mais tarde.",
    });
    expect(data.history).toBeUndefined();
    expect(data.specs?.source).toBe("fipe-name");
  });

  it("runs only the requested providers and ignores aborts", async () => {
    const set = providers({
      inmetro: {
        id: "inmetro",
        lookup: vi.fn(async () => {
          throw new HttpError("aborted", "FIPE", "u");
        }),
      },
    });
    const { data, errors } = await enrichVehicle(vehicle, {
      providers: set,
      only: ["inmetro"],
    });

    expect(set.history.lookup).not.toHaveBeenCalled();
    expect(data).toEqual({});
    expect(errors).toEqual({});
  });
});

describe("catalog providers", () => {
  const index = {
    generatedAt: "",
    snapshots: [],
    entries: [
      {
        brand: "Fiat",
        fipeBrand: "Fiat",
        model: "ARGO DRIVE 1.3 8V  Flex Aut.",
        yearCode: "2026-5",
        inmetro: spec,
        wikidata: { id: "Q30013813", label: "Fiat Argo" },
      },
      {
        brand: "Chery",
        fipeBrand: "Caoa Chery/Chery",
        model: "Tiggo 2 1.5 16V Flex Aut.",
        yearCode: "2022-5",
        inmetro: spec,
      },
    ],
  } as unknown as CatalogIndex;

  it("finds the catalog entry by brand, model name and year", () => {
    expect(findCatalogEntry(index, vehicle)?.inmetro).toBe(spec);
    expect(findCatalogEntry(index, { ...vehicle, yearCode: "2025-5" })).toBeUndefined();
    // The catalog shows one maker's FIPE brands as one; the Consulta still says FIPE's name.
    const tiggo = { ...vehicle, brand: "Caoa Chery/Chery", model: "Tiggo 2 1.5 16V Flex Aut.", yearCode: "2022-5" };
    expect(findCatalogEntry(index, tiggo)?.brand).toBe("Chery");
  });

  it("returns INMETRO data with the match confidence", async () => {
    const provider = createInmetroProvider(async () => index);
    await expect(provider.lookup(vehicle)).resolves.toEqual({
      source: "inmetro",
      confidence: "fuzzy",
      data: spec,
    });
    await expect(createInmetroProvider(async () => null).lookup(vehicle)).resolves.toBeNull();
  });

  it("returns the Wikidata model line as fuzzy, for any year of the version", async () => {
    const provider = createModelInfoProvider(async () => index);
    await expect(provider.lookup({ ...vehicle, yearCode: "2019-5" })).resolves.toEqual({
      source: "wikidata",
      confidence: "fuzzy",
      data: { id: "Q30013813", label: "Fiat Argo" },
    });
    await expect(provider.lookup({ ...vehicle, model: "CRONOS 1.3" })).resolves.toBeNull();
  });
});
