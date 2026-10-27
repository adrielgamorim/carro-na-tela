import { describe, expect, it } from "vitest";
import {
  filterModelsByFamily,
  filterVehicles,
  formatModelYear,
  getModelFamilies,
  getModelFamily,
  normalizeYearOptions,
  parseFipePrice,
  parseFipeYearCode,
} from "./fipe";
import type { FipeVehicle } from "../types/vehicle";

const vehicles: FipeVehicle[] = [
  {
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
  },
  {
    id: "cars:1:002:2022",
    category: "cars",
    brand: "Toyota",
    model: "Corolla XEi",
    codeFipe: "002-0",
    fuel: "Flex",
    fuelAcronym: "F",
    modelYear: 2022,
    price: "R$ 158.900,00",
    priceValue: 158900,
    referenceMonth: "outubro/2026",
    referenceCode: "1",
    yearCode: "2022-1",
  },
];

describe("FIPE price filters", () => {
  it("normalizes Brazilian currency strings", () => {
    expect(parseFipePrice("R$ 120.450,00")).toBe(120450);
  });

  it("filters by text and an inclusive price range", () => {
    expect(
      filterVehicles(vehicles, {
        query: "corolla",
        minPrice: 150000,
        maxPrice: 160000,
      }).map((vehicle) => vehicle.id),
    ).toEqual(["cars:1:002:2022"]);
  });

  it("filters by category, brand, model, and year", () => {
    expect(
      filterVehicles(vehicles, {
        query: "",
        minPrice: null,
        maxPrice: null,
        category: "cars",
        brand: "Honda",
        model: "Civic Touring",
        modelYear: 2020,
      }).map((vehicle) => vehicle.id),
    ).toEqual(["cars:1:001:2020"]);
  });
});

describe("FIPE model families", () => {
  it("groups full model names by their first word", () => {
    const models = [
      { code: "1", name: "EcoSport XLS 2.0" },
      { code: "2", name: "EcoSport SE 1.6" },
      { code: "3", name: "  Focus SE Plus  " },
    ];

    expect(getModelFamilies(models)).toEqual(["EcoSport", "Focus"]);
    expect(getModelFamily(models[1].name)).toBe("EcoSport");
  });

  it("matches model families without case-sensitive duplicates", () => {
    const models = [
      { code: "1", name: "EcoSport XLS 2.0" },
      { code: "2", name: "ECOSPORT SE 1.6" },
      { code: "3", name: "Focus SE Plus" },
    ];

    expect(getModelFamilies(models)).toEqual(["EcoSport", "Focus"]);
    expect(filterModelsByFamily(models, "EcoSport")).toEqual(models.slice(0, 2));
  });

  it("keeps two-word family names together", () => {
    const models = [
      { code: "1", name: "Grand Siena ATTRACTIV 1.4" },
      { code: "2", name: "Siena EL 1.0" },
      { code: "3", name: "Range Rover Evoque 2.0" },
      { code: "4", name: "Classe C 180 1.6" },
    ];

    expect(getModelFamilies(models)).toEqual([
      "Grand Siena",
      "Siena",
      "Range Rover",
      "Classe C",
    ]);
    expect(filterModelsByFamily(models, "Grand Siena")).toEqual([models[0]]);
    expect(getModelFamily("Grand")).toBe("Grand");
  });
});

describe("FIPE year options", () => {
  it("parses the year and fuel identifier from the FIPE year code", () => {
    expect(parseFipeYearCode("2020-5")).toEqual({
      modelYear: 2020,
      fuelCode: "5",
    });
    expect(parseFipeYearCode("invalid")).toBeNull();
  });

  it("drops implausible years and sorts valid options newest first", () => {
    expect(
      normalizeYearOptions([
        { code: "2020-1", name: "2020 Gasolina" },
        { code: "2999-1", name: "2999 Gasolina" },
        { code: "1850-1", name: "1850 Gasolina" },
        { code: "2026-3", name: "2026 Diesel" },
      ]),
    ).toEqual([
      { code: "2026-3", name: "2026 Diesel" },
      { code: "2020-1", name: "2020 Gasolina" },
    ]);
  });

  it("keeps FIPE's 32000 as 0 km, listed first", () => {
    expect(
      normalizeYearOptions([
        { code: "2026-6", name: "2026 Híbrido" },
        { code: "32000-6", name: "32000 Híbrido" },
      ]),
    ).toEqual([
      { code: "32000-6", name: "0 km Híbrido" },
      { code: "2026-6", name: "2026 Híbrido" },
    ]);
    expect(formatModelYear(32000)).toBe("0 km");
    expect(formatModelYear(2026)).toBe("2026");
  });
});
