import { describe, expect, it } from "vitest";
import { loadSession, saveSession } from "./storage";
import type { FipeVehicle } from "../types/vehicle";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const civic: FipeVehicle = {
  id: "cars:1:001:2020",
  category: "cars",
  brand: "Honda",
  model: "Civic Touring",
  codeFipe: "001-0",
  fuel: "Gasolina",
  fuelAcronym: "G",
  modelYear: 2020,
  price: "R$ 120.450,00",
  priceValue: 120450,
  referenceMonth: "outubro/2026",
  referenceCode: "1",
  yearCode: "2020-1",
};
const corolla: FipeVehicle = {
  ...civic,
  id: "cars:1:002:2022",
  model: "Corolla XEi",
  codeFipe: "002-0",
};

describe("session storage", () => {
  it("round-trips consulted vehicles and the comparison selection", () => {
    const storage = memoryStorage();
    saveSession({ consulted: [civic, corolla], comparison: [corolla] }, storage);

    expect(loadSession(storage)).toEqual({
      consulted: [civic, corolla],
      comparison: [corolla],
    });
  });

  it("returns an empty session for missing or corrupt data", () => {
    const empty = { consulted: [], comparison: [] };

    expect(loadSession(memoryStorage())).toEqual(empty);
    expect(
      loadSession(memoryStorage({ "carro-na-tela:session:v1": "{not json" })),
    ).toEqual(empty);
    expect(loadSession(undefined)).toEqual(empty);
  });

  it("drops malformed vehicles and comparison ids without a vehicle", () => {
    const storage = memoryStorage({
      "carro-na-tela:session:v1": JSON.stringify({
        consulted: [civic, { id: "broken" }],
        comparisonIds: [civic.id, "broken", "missing"],
      }),
    });

    expect(loadSession(storage)).toEqual({
      consulted: [civic],
      comparison: [civic],
    });
  });
});
