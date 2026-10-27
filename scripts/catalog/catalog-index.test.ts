import { describe, expect, it } from "vitest";
import { expandCatalogIndex } from "../../src/catalog/indexFormat.ts";
import { buildCatalogIndex, selectLatestSnapshots } from "./catalog-index.ts";
import type { CrawlSnapshot } from "./catalog-index.ts";
import type { CrawledVehicle } from "./crawl.ts";
import type { PbevRow } from "../../src/catalog/inmetro.ts";

function vehicle(overrides: Partial<CrawledVehicle>): CrawledVehicle {
  return {
    id: "21-10:2024-5",
    brandCode: "21",
    brand: "Fiat",
    modelCode: "10",
    model: "PULSE AUDACE 1.0 Turbo 200 Flex Aut.",
    yearCode: "2024-5",
    modelYear: 2024,
    fuel: "Flex",
    zeroKm: false,
    attributes: { engineLiters: 1, aspiration: "turbo" },
    detail: {
      codeFipe: "001580-1",
      fuelAcronym: "F",
      price: "R$ 98.990,00",
      priceValue: 98990,
      referenceMonth: "outubro de 2026",
    },
    ...overrides,
  };
}

function snapshot(reference: string, vehicles: CrawledVehicle[]): CrawlSnapshot {
  return {
    reference,
    referenceMonth: "outubro de 2026",
    category: "cars",
    listingComplete: false,
    stats: { availableBrands: 108 },
    vehicles,
  };
}

describe("selectLatestSnapshots", () => {
  it("keeps the newest reference per category", () => {
    const older = snapshot("337", []);
    const newer = snapshot("338", []);
    const trucks = { ...snapshot("330", []), category: "trucks" as const };

    expect(selectLatestSnapshots([newer, older, trucks])).toEqual([newer, trucks]);
  });
});

describe("buildCatalogIndex", () => {
  const vehicles = [
    vehicle({}),
    vehicle({
      id: "21-10:32000-5",
      yearCode: "32000-5",
      modelYear: 32000,
      zeroKm: true,
      detail: null,
    }),
    vehicle({
      id: "238-7:2025-4",
      brandCode: "238",
      brand: "BYD",
      modelCode: "7",
      model: "Dolphin Mini GL",
      yearCode: "2025-4",
      modelYear: 2025,
      fuel: "Elétrico",
      attributes: {},
      detail: null,
    }),
  ];

  it("writes one compact row per version with years newest first", () => {
    const index = buildCatalogIndex(
      [snapshot("338", vehicles)],
      { now: new Date("2026-10-26T12:00:00Z") },
    );

    expect(index).toEqual({
      version: 2,
      generatedAt: "2026-10-26T12:00:00.000Z",
      snapshots: [
        {
          category: "cars",
          reference: "338",
          referenceMonth: "outubro de 2026",
          listingComplete: false,
          brands: ["BYD", "Fiat"],
          availableBrands: 108,
          listed: 3,
          priced: 1,
        },
      ],
      brands: [
        { code: "21", name: "Fiat" },
        { code: "238", name: "BYD" },
      ],
      fuels: { "5": "Flex", "4": "Elétrico" },
      versions: [
        { s: 0, b: 1, m: "7", n: "Dolphin Mini GL", y: [["2025-4", null]] },
        {
          s: 0,
          b: 0,
          m: "10",
          n: "PULSE AUDACE 1.0 Turbo 200 Flex Aut.",
          f: "001580-1",
          a: { engineLiters: 1, aspiration: "turbo" },
          y: [
            ["32000-5", null],
            ["2024-5", 98990],
          ],
        },
      ],
    });
  });

  it("expands back into catalog entries", () => {
    const { entries } = expandCatalogIndex(buildCatalogIndex([snapshot("338", vehicles)]));

    expect(entries.map((entry) => [entry.id, entry.modelYear, entry.priceValue])).toEqual([
      ["238-7:2025-4", 2025, null],
      ["21-10:32000-5", null, null],
      ["21-10:2024-5", 2024, 98990],
    ]);
    expect(entries[0]).toMatchObject({
      brand: "BYD",
      family: "Dolphin",
      fuel: "Elétrico",
      propulsion: "eletrico",
      codeFipe: null,
      price: null,
      referenceCode: "338",
    });
    expect(entries[2]).toMatchObject({
      codeFipe: "001580-1",
      price: "R$ 98.990,00",
      zeroKm: false,
      attributes: { aspiration: "turbo" },
    });
  });

  it("attaches INMETRO data to recent versions and merges it into entries", () => {
    const pbev = [
      {
        table: 2026,
        category: "Utilitário Esportivo Compacto",
        brand: "FIAT",
        model: "PULSE",
        version: "AUDACE T200 AT",
        engine: "1.0T-12V",
        size: "compacto" as const,
        body: "suv" as const,
        fourWheelDrive: false,
        propulsion: "combustao" as const,
        fuel: "flex" as const,
        transmission: "cvt" as const,
        gears: 7,
        airConditioning: true,
        steering: "eletrica" as const,
        consumption: {
          ethanolCity: 8.6,
          ethanolHighway: 10.1,
          fuelCity: 12.1,
          fuelHighway: 14.1,
          electricCity: null,
          electricHighway: null,
        },
        rangeKm: null,
        energyMjKm: 1.55,
      },
    ];
    const pulse = vehicle({
      id: "21-12:2026-5",
      modelCode: "12",
      model: "PULSE AUDACE Turbo 200 Aut.",
      yearCode: "2026-5",
      modelYear: 2026,
      attributes: { aspiration: "turbo", transmission: "automatico" },
    });
    const old = vehicle({ id: "21-13:2015-5", modelCode: "13", model: "PULSE OLD 1.0 Aut.", yearCode: "2015-5", modelYear: 2015 });
    const file = buildCatalogIndex([snapshot("338", [pulse, old])], { pbev });

    expect(file.snapshots[0]?.inmetroMatched).toBe(1);
    expect(file.versions.find((version) => version.m === "13")?.i).toBeUndefined();

    const entry = expandCatalogIndex(file).entries.find((item) => item.modelCode === "12");
    expect(entry).toMatchObject({
      transmission: "cvt",
      gears: 7,
      bodyType: "suv",
      size: "compacto",
      cityKmL: 12.1,
      highwayKmL: 14.1,
      airConditioning: true,
      attributes: { engineLiters: 1, aspiration: "turbo" },
      inmetro: { version: "AUDACE T200 AT", confidence: "exact" },
    });
  });

  it("matches each version with the table of its model years", () => {
    const row = (table: number, version: string, fuelCity: number): PbevRow => ({
      table,
      category: "Compacto",
      brand: "FIAT",
      model: "ARGO",
      version,
      engine: "1.0-6V",
      size: "compacto",
      body: null,
      fourWheelDrive: false,
      propulsion: "combustao",
      fuel: "flex",
      transmission: "manual",
      gears: 5,
      airConditioning: true,
      steering: "eletrica",
      consumption: {
        ethanolCity: null,
        ethanolHighway: null,
        fuelCity,
        fuelHighway: null,
        electricCity: null,
        electricHighway: null,
      },
      rangeKm: null,
      energyMjKm: null,
    });
    const pbev = [row(2026, "DRIVE 2026", 13.6), row(2018, "DRIVE 2018", 12.1)];
    const argo = (modelCode: string, yearCodes: string[]) =>
      yearCodes.map((yearCode) =>
        vehicle({
          id: `21-${modelCode}:${yearCode}`,
          modelCode,
          model: "ARGO DRIVE 1.0 6V Flex",
          yearCode,
          modelYear: Number(yearCode.split("-")[0]),
          zeroKm: yearCode.startsWith("32000"),
          attributes: { engineLiters: 1, valves: 6, fuel: "flex" },
        }),
      );

    const file = buildCatalogIndex(
      [
        snapshot("338", [
          ...argo("1", ["32000-5", "2026-5"]),
          ...argo("2", ["2019-5", "2018-5"]),
          ...argo("3", ["2012-5"]),
        ]),
      ],
      { pbev },
    );
    const table = (modelCode: string) =>
      file.versions.find((version) => version.m === modelCode)?.i?.table;

    expect(table("1")).toBe(2026);
    expect(table("2")).toBe(2018);
    // No table covers 2011–2013 here.
    expect(table("3")).toBeUndefined();
    expect(file.snapshots[0]?.inmetroMatched).toBe(2);
  });

  it("applies manual overrides: force a row, skip tables or block", () => {
    const row = (table: number, version: string, engine: string): PbevRow => ({
      table,
      category: "Utilitário Esportivo Compacto",
      brand: "HYUNDAI",
      model: "CRETA",
      version,
      engine,
      size: "compacto",
      body: "suv",
      fourWheelDrive: false,
      propulsion: "combustao",
      fuel: "flex",
      transmission: "automatico",
      gears: 6,
      airConditioning: true,
      steering: "eletrica",
      consumption: {
        ethanolCity: null,
        ethanolHighway: null,
        fuelCity: 10,
        fuelHighway: 12,
        electricCity: null,
        electricHighway: null,
      },
      rangeKm: null,
      energyMjKm: null,
    });
    const pbev = [row(2026, "Ultimate", "1.6-16V T"), row(2024, "Action", "1.6-16V")];
    const creta = (modelCode: string, model: string) =>
      vehicle({
        id: `26-${modelCode}:2025-5`,
        brandCode: "26",
        brand: "Hyundai",
        modelCode,
        model,
        yearCode: "2025-5",
        modelYear: 2025,
        attributes: { engineLiters: 1.6, valves: 16, transmission: "automatico", fuel: "flex" },
      });
    const vehicles = [
      creta("1", "Creta Action 1.6 16V Flex Aut."),
      creta("2", "Creta Smart 1.6 16V Flex Aut."),
      creta("3", "Creta Pulse 1.6 16V Flex Aut."),
    ];
    const warnings: string[] = [];
    const file = buildCatalogIndex([snapshot("338", vehicles)], {
      pbev,
      overrides: [
        { brand: "Hyundai", modelPrefix: "Creta Action", use: { table: 2024, model: "creta", version: "ACTION" } },
        { brand: "Hyundai", model: "Creta Smart 1.6 16V Flex Aut.", none: true },
        { brand: "Hyundai", model: "creta pulse 1.6 16v flex aut.", use: { table: 2026, model: "CRETA", version: "Nope" } },
      ],
      onWarning: (message) => warnings.push(message),
    });
    const spec = (modelCode: string) => file.versions.find((version) => version.m === modelCode)?.i;

    expect(spec("1")).toMatchObject({ table: 2024, version: "Action", confidence: "exact" });
    expect(spec("2")).toBeUndefined();
    expect(spec("3")).toBeUndefined();
    expect(warnings).toEqual([
      "Ajuste sem linha no INMETRO 2026: CRETA Nope (para Creta Pulse 1.6 16V Flex Aut.)",
    ]);

    const skipped = buildCatalogIndex([snapshot("338", [vehicles[1]!])], {
      pbev: [row(2026, "Smart", "1.6-16V"), row(2024, "Smart", "1.6-16V")],
      overrides: [{ brand: "Hyundai", modelPrefix: "Creta Smart", skipTables: [2026] }],
    });
    expect(skipped.versions[0]?.i?.table).toBe(2024);
  });

  it("ignores older snapshots of the same category", () => {
    const index = buildCatalogIndex([
      snapshot("337", [vehicle({ model: "antigo" })]),
      snapshot("338", [vehicle({})]),
    ]);

    expect(index.versions.map((version) => version.n)).toEqual([
      "PULSE AUDACE 1.0 Turbo 200 Flex Aut.",
    ]);
  });
});
