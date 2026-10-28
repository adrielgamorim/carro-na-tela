import { describe, expect, it } from "vitest";
import { sheetFields, sheetHeading, sheetLine, sheetOfVersion, sheetSpecs, sheetYear, trimsOf } from "./sheets.ts";

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

  it("reads sheets laid out as tables, labels anywhere in the line", () => {
    // Lines of the real "Argo 1.0 Flex MT" sheet.
    const argo = [
      "ARGO 1.0 Flex MT",
      "performance GASOLINA (E22)",
      "Potência máxima ABNT 72,0 cv 53,0 kW @ 6000 rpm",
      "Torque máximo ABNT 10,4 kgfm 102,0 Nm @ 3250 rpm",
      "ETANOL",
      "Potência máxima ABNT 77,0 cv 57,0 kW @ 6250 rpm",
      "Torque máximo ABNT 10,9 kgfm 107,0 Nm @ 3250 rpm",
      "Coluna de direção articulada com juntas universais com regulagem de altura",
      "Comprimento (L103) 3998,0 mm",
      "Largura da carroceria (W103) 1724,0 mm",
      "Largura entre retrovisores (W104+ W105) 1962,0 mm",
      "Altura veículo vazio (H100) 1503,0 mm",
      "Distância entre eixos (L101) 2521,0 mm",
      "Altura mínima do solo veículo vazio 154,7 mm",
      "RESERVATÓRIOS Tanque de combustível (reserva) 48,0 L (5,5 a 7,5 L)",
      "velocidade máxima por marcha 1ª marcha 35,3 km/h 35,3 km/h",
      "aceleração a partir do repouso 0 a 100 Km/h 14,4 s 13,4 s",
    ];
    expect(sheetSpecs(argo)).toEqual({
      powerCv: 77,
      torqueKgfm: 10.9,
      lengthMm: 3998,
      widthMm: 1724,
      heightMm: 1503,
      wheelbaseMm: 2521,
      groundClearanceMm: 154.7,
      tankLiters: 48,
      zeroTo100s: 13.4,
    });
    // Citroën writes just "Potência" and "Torque".
    expect(sheetSpecs(["Potência : 125 cv (gasolina) / 130 cv (etanol)", "Torque : 20,4 kgfm / 200 Nm"])).toEqual({
      powerCv: 130,
      torqueKgfm: 20.4,
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

describe("telling close versions apart", () => {
  const c3 = ["C3 Feel 1.0 Flex 6V 5p Mec.", "C3 Feel Plus 1.0 6V 5p Mec.", "C3 Live 1.0 Flex 6V 5p Mec."];
  const strada = ["Strada Endurance 1.4 Flex 8V CS Plus", "Strada Endurance 1.4 Flex 8V CD", "Strada Freedom 1.3 Flex 8V CD"];

  it("keeps a Plus trim apart from the plain one", () => {
    const sheets = [{ id: 1, brand: "citroen", title: "Citroën C3 1.0 Fe el Plus MT – 2026/2026", pageTitle: "Citroën C3 MY 2026", modelYear: 2026 }];
    const trims = trimsOf(c3, "C3");
    const of = (name: string) =>
      sheetOfVersion(sheets, { brand: "Citroën", family: "C3", name, modelYear: 2026, engineLiters: 1, turbo: false }, trims)?.id;
    expect(of("C3 Feel Plus 1.0 6V 5p Mec.")).toBe(1);
    expect(of("C3 Feel 1.0 Flex 6V 5p Mec.")).toBeUndefined();
  });

  it("matches a pickup's cab", () => {
    const sheets = [{ id: 1, brand: "fiat", title: "FIAT STRADA ENDURANCE 1.4 CABINE DUPLA", pageTitle: "Strada MY 2021", modelYear: 2021 }];
    const trims = trimsOf(strada, "Strada");
    const of = (name: string) =>
      sheetOfVersion(sheets, { brand: "Fiat", family: "Strada", name, modelYear: 2021, engineLiters: 1.4, turbo: false }, trims)?.id;
    expect(of("Strada Endurance 1.4 Flex 8V CD")).toBe(1);
    expect(of("Strada Endurance 1.4 Flex 8V CS Plus")).toBeUndefined();
  });

  it("cleans a sheet's heading", () => {
    expect(sheetHeading(["FIAT CRONOS 1. 0", "Ficha técnica", "Motor"])).toBe("FIAT CRONOS 1.0");
    expect(
      sheetHeading(["FIAT CRONOS DRIVE 1.8 AT6 As informações contidas nesse documento estão sujeitas a atualização"]),
    ).toBe("FIAT CRONOS DRIVE 1.8 AT6");
  });
});
