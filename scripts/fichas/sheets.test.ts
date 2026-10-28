import { describe, expect, it } from "vitest";
import { sheetFields, sheetLine, sheetOfVersion, sheetSpecs, sheetYear, trimsOf } from "./sheets.ts";

// Lines of the real "Fiat Pulse Turbo 200 Flex Automático" sheet, as the PDF reader gives them.
const pulse = [
  "FIAT PULSE TURBO 200 FLEX AUTOMÁTICO – Ficha técnica",
  "Motor",
  "Cilindrada total: 999 cm³",
  "Potência máxima (ABNT): 125 cv (gasolina) / 130 cv (etanol)",
  "a 5.750 rpm",
  "Torque máximo (ABNT): 200 Nm / 20,4 kgfm (gasolina) / 200",
  "Nm / 20,4 kgfm (etanol) a 1.700 rpm",
  "Peso do veículo",
  "Em ordem de marcha: 1.234 kg",
  "Capacidade de carga: 400 kg",
  "Comprimento do veículo:4.095mm",
  "Largura do veículo: 1.776 mm",
  "(s/espelhos) 1.989 mm(c/espelhos)",
  "Altura do veículo (vazio): 1.553 mm",
  "Distância entre - eixos: 2.532 mm",
  "Altura mínima do solo: 200,2 mm",
  "Volume do porta - malas: 370 litros",
  "Tanque de combustível: 45 litros",
  "Desempenho",
  "Velocidade máxima: 187 km/h (gasolina) / 189 km/h (etanol)",
  "0 a 100 km/h: 9,7 s (gasolina) / 9,4 s (etanol)",
];

describe("spec sheets", () => {
  it("joins a value that wraps to the next line", () => {
    const torque = sheetFields(pulse).find((field) => field.label.startsWith("torque"));
    expect(torque?.value).toBe("200 Nm / 20,4 kgfm (gasolina) / 200 Nm / 20,4 kgfm (etanol) a 1.700 rpm Peso do veículo");
  });

  it("reads the figures the app shows", () => {
    expect(sheetSpecs(pulse)).toEqual({
      powerCv: 130,
      torqueKgfm: 20.4,
      weightKg: 1234,
      lengthMm: 4095,
      widthMm: 1776,
      heightMm: 1553,
      wheelbaseMm: 2532,
      groundClearanceMm: 200.2,
      trunkLiters: 370,
      tankLiters: 45,
      topSpeedKmh: 189,
      zeroTo100s: 9.4,
    });
  });

  it("converts torque given only in Nm", () => {
    expect(sheetSpecs(["Torque máximo: 270 Nm a 1.750 rpm"]).torqueKgfm).toBe(27.5);
  });
});

describe("matching sheets to FIPE versions", () => {
  // Real titles from the press room: readable, "Ficha técnica_…", and file names glued together.
  const sheet = (id: number, title: string, pageTitle: string, modelYear: number | null) =>
    ({ id, brand: "fiat", title, pageTitle, modelYear });
  const sheets = [
    sheet(1, "Pulse Drive 1.3 Flex Manual", "Fiat Pulse MY 2022", 2022),
    sheet(2, "Pulse Drive Turbo 200 Flex Automático", "Fiat Pulse MY 2022", 2022),
    sheet(3, "Pulse Audace Turbo 200 Flex Automático", "Fiat Pulse MY 2022", 2022),
    sheet(4, "Ficha técnica_Pulse Audace Turbo 200 Flex Automático - MY23", "Fiat Pulse MY 2023", 2023),
    sheet(5, "fichatecnicapulsedrive13flexmanualmy27-6a84abde9579c", "Fiat Pulse MY27", 2027),
    sheet(6, "fichatecnicapulsedrive13flexautomaticomy27-6a84abde972a5", "Fiat Pulse MY27", 2027),
    sheet(7, "Ficha técnica_Pulse SDesign 1.3 Flex Automático - MY24", "Fiat Pulse MY 2024", 2024),
  ];
  const names = [
    "PULSE DRIVE 1.3 8V Flex",
    "PULSE DRIVE 1.3 8V Flex Aut.",
    "PULSE DRIVE 1.0 Turbo 200 Flex Aut.",
    "PULSE AUDACE 1.0 Turbo 200 Flex Aut.",
    "PULSE IMPETUS 1.0 Turbo 200 Flex Aut.",
    "PULSE S-DESIGN 1.3 8V Flex Aut.",
  ];
  const trims = trimsOf(names, "PULSE");
  const pulse = (name: string, modelYear: number, engineLiters: number, turbo: boolean) =>
    sheetOfVersion(sheets, { brand: "Fiat", family: "PULSE", name, modelYear, engineLiters, turbo }, trims)?.id;

  it("knows the line's trims", () => {
    expect([...trims].sort()).toEqual(["audace", "design", "drive", "impetus"]);
  });

  it("finds the sheet of the same trim, engine, transmission and model year", () => {
    expect(pulse("PULSE AUDACE 1.0 Turbo 200 Flex Aut.", 2022, 1, true)).toBe(3);
    expect(pulse("PULSE AUDACE 1.0 Turbo 200 Flex Aut.", 2023, 1, true)).toBe(4);
    expect(pulse("PULSE DRIVE 1.3 8V Flex", 2022, 1.3, false)).toBe(1);
    expect(pulse("PULSE DRIVE 1.0 Turbo 200 Flex Aut.", 2022, 1, true)).toBe(2);
    // Glued titles.
    expect(pulse("PULSE DRIVE 1.3 8V Flex", 2027, 1.3, false)).toBe(5);
    expect(pulse("PULSE DRIVE 1.3 8V Flex Aut.", 2027, 1.3, false)).toBe(6);
  });

  it("finds none for another year, trim or transmission", () => {
    expect(pulse("PULSE AUDACE 1.0 Turbo 200 Flex Aut.", 2025, 1, true)).toBeUndefined();
    expect(pulse("PULSE IMPETUS 1.0 Turbo 200 Flex Aut.", 2022, 1, true)).toBeUndefined();
    expect(pulse("PULSE DRIVE 1.3 8V Flex Aut.", 2022, 1.3, false)).toBeUndefined();
  });

  it("reads the model year from the title when the page has none", () => {
    expect(sheetYear({ modelYear: null, title: "Ficha Técnica Peugeot 208 GT MHEV 2026_2027" })).toBe(2027);
    expect(sheetYear({ modelYear: null, title: "Ficha Técnica Titano Endurance MY26" })).toBe(2026);
    expect(sheetLine("Jeep® Compass MY 2022")).toBe("compass");
    expect(sheetLine("Nova Strada MY 2022")).toBe("strada");
  });
});
