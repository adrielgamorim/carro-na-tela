import { describe, expect, it } from "vitest";
import { parseNumber, parsePbevLines, parseTransmission, pbevColumns, pbevLayouts } from "./pbev.ts";
import type { PdfTextLine } from "./pbev.ts";

const c = pbevColumns;

function line(page: number, y: number, cells: [number, string][]): PdfTextLine {
  return { page, y, cells: cells.map(([center, text]) => ({ center, text })) };
}

// Mobi Trekking, as it appears on page 1 of the 2026 table (emission and
// rating columns included to check they are ignored).
const mobi = line(1, 445, [
  [c.category, "Sub Compacto"],
  [c.brand, "FIAT"],
  [c.model, "MOBI"],
  [c.version, "TREKKING"],
  [c.engine, "1.0-6V"],
  [c.propulsion, "Combustão"],
  [c.transmission, "M-5"],
  [c.airConditioning, "S"],
  [c.steering, "E"],
  [c.fuel, "F"],
  [396, "38"],
  [431, "B"],
  [c.ethanolCity, "9,8"],
  [c.ethanolHighway, "10,6"],
  [c.fuelCity, "14,0"],
  [c.fuelHighway, "15,1"],
  [c.electricCity, "\\"],
  [594, "1,46"],
  [c.rangeKm, "\\"],
]);

describe("parsePbevLines", () => {
  it("reads a combustion row by column position", () => {
    expect(parsePbevLines([mobi], 2026)).toEqual([
      {
        table: 2026,
        category: "Sub Compacto",
        brand: "FIAT",
        model: "MOBI",
        version: "TREKKING",
        engine: "1.0-6V",
        size: "subcompacto",
        body: null,
        fourWheelDrive: false,
        propulsion: "combustao",
        fuel: "flex",
        transmission: "manual",
        gears: 5,
        airConditioning: true,
        steering: "eletrica",
        consumption: {
          ethanolCity: 9.8,
          ethanolHighway: 10.6,
          fuelCity: 14,
          fuelHighway: 15.1,
          electricCity: null,
          electricHighway: null,
        },
        rangeKm: null,
        energyMjKm: 1.46,
      },
    ]);
  });

  it("merges wrapped cells into their row and ignores rating-only lines", () => {
    const tCross = line(5, 306, [
      [c.category, "Utilitário Esportivo Compacto"],
      [c.brand, "VW"],
      [c.model, "T CROSS"],
      [c.engine, "1.0-12V"],
      [c.propulsion, "Combustão"],
      [c.transmission, "A - 6"],
      [c.fuel, "F"],
    ]);
    const rows = parsePbevLines(
      [
        tCross,
        line(5, 308, [[c.version, "COMFORTLINE 200TSI"]]),
        line(5, 305, [[c.version, "AUTOMATICO"]]),
        line(5, 310, [[431, "A"], [629, "B"]]),
        line(5, 280, [[c.version, "far away"]]),
      ],
      2026,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      version: "COMFORTLINE 200TSI AUTOMATICO",
      size: "compacto",
      body: "suv",
      transmission: "automatico",
      gears: 6,
    });
  });

  it("maps electric rows and 4x4 categories", () => {
    const [ev, offRoad] = parsePbevLines(
      [
        line(1, 458, [
          [c.category, "Sub Compacto"],
          [c.brand, "BYD"],
          [c.model, "DOLPHIN MINI"],
          [c.version, "GS EV"],
          [c.engine, "Elétrico"],
          [c.propulsion, "Elétrico"],
          [c.transmission, "N.A."],
          [c.fuel, "E"],
          [c.electricCity, "58,59"],
          [c.electricHighway, "41,9"],
          [c.rangeKm, "280"],
        ]),
        line(6, 300, [
          [c.category, "Utilitário Esportivo Grande 4x4"],
          [c.brand, "JEEP"],
          [c.model, "COMMANDER"],
          [c.propulsion, "Plug-in"],
          [c.fuel, "E100"],
        ]),
      ],
      2026,
    );

    expect(ev).toMatchObject({
      propulsion: "eletrico",
      fuel: "eletrico",
      transmission: null,
      consumption: { electricCity: 58.59, electricHighway: 41.9 },
      rangeKm: 280,
    });
    expect(offRoad).toMatchObject({
      size: "grande",
      body: "suv",
      fourWheelDrive: true,
      propulsion: "hibrido-plugin",
      fuel: "etanol",
    });
  });

  it("skips header lines", () => {
    expect(
      parsePbevLines([line(1, 478, [[180, "Categoria"], [c.brand, "Marca"]])], 2026),
    ).toEqual([]);
  });
});

describe("older table layouts", () => {
  const layout2013 = pbevLayouts[2013].columns as Record<string, number | number[]>;
  const at = (column: string, part = 0) => {
    const centers = layout2013[column];
    return Array.isArray(centers) ? centers[part] : centers;
  };
  const row2013 = (y: number, brand: string, model: string, cityGas: string): PdfTextLine =>
    line(1, y, [
      [at("brand"), brand],
      [at("model"), model],
      [at("engine", 0), "1.0"],
      [at("engine", 1), "8V"],
      [at("transmission", 0), "M"],
      [at("transmission", 1), "5"],
      [at("airConditioning"), "N"],
      [at("steering"), "M"],
      [at("fuel"), "F"],
      [at("ethanolCity"), "8,9"],
      [at("ethanolHighway"), "10,7"],
      [at("fuelCity"), cityGas],
      [at("fuelHighway"), "15,6"],
    ]);

  it("joins split engine and transmission columns", () => {
    const [uno] = parsePbevLines([row2013(300, "FIAT", "Uno", "12,7")], 2013);
    expect(uno).toMatchObject({
      engine: "1.0 8V",
      transmission: "manual",
      gears: 5,
      fuel: "flex",
      propulsion: "combustao",
      consumption: { ethanolCity: 8.9, fuelCity: 12.7 },
    });
  });

  it("spreads a merged category over its group, split where the brand order restarts", () => {
    const rows = parsePbevLines(
      [
        row2013(300, "FIAT", "Uno", "12,7"),
        row2013(290, "VW", "Up", "13,0"),
        // The merged "Sub Compacto" label sits between its rows.
        line(1, 295, [[at("category"), "Sub Compacto"]]),
        row2013(280, "CHEVROLET", "Onix", "12,0"),
        row2013(270, "FIAT", "Argo", "12,9"),
        line(1, 275, [[at("category"), "Compacto"]]),
      ],
      2013,
    );
    expect(rows.map((row) => `${row.model}:${row.size}`)).toEqual([
      "Uno:subcompacto",
      "Up:subcompacto",
      "Onix:compacto",
      "Argo:compacto",
    ]);
  });

  it("reads decimal points, guesses propulsion from names and drops implausible values", () => {
    const columns2024 = pbevLayouts[2024].columns as Record<string, number>;
    const [ev] = parsePbevLines(
      [
        line(1, 300, [
          [columns2024.brand, "BYD"],
          [columns2024.model, "DOLPHIN"],
          [columns2024.engine, "Elétrico"],
          [columns2024.propulsion, "Elétrico"],
          [columns2024.fuel, "E"],
          [columns2024.electricCity, "58.6"],
          [columns2024.electricHighway, "999.9"],
        ]),
      ],
      2024,
    );
    expect(ev.consumption).toMatchObject({ electricCity: 58.6, electricHighway: null });

    const [hybrid] = parsePbevLines(
      [{ ...row2013(300, "TOYOTA", "Prius", "18,9"), cells: [...row2013(300, "TOYOTA", "Prius", "18,9").cells, { center: at("version"), text: "Hybrid" }] }],
      2013,
    );
    expect(hybrid.propulsion).toBe("hibrido");
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("47.3")).toBe(47.3);
  });
});

describe("parseTransmission", () => {
  it.each([
    ["M-5", "manual", 5],
    ["A - 8", "automatico", 8],
    ["CVT-7", "cvt", 7],
    ["CVT 9", "cvt", 9],
    ["(CVT) CVT", "cvt", null],
    ["eCVT", "cvt", null],
    ["DCT-8", "dct", 8],
    ["DTC - 7", "dct", 7],
    ["DHT-1A - 2", "automatico", 2],
    ["AT", "automatico", null],
    ["MT", "manual", null],
    ["A-1", "automatico", null],
    ["N.A.", null, null],
  ])("%s", (text, transmission, gears) => {
    expect(parseTransmission(text)).toEqual({ transmission, gears });
  });
});
