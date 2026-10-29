import { describe, expect, it } from "vitest";
import { litersOf, openSheetOfVersion, renaultSheets, specsOfFields, vwSheet } from "./open-sheets.ts";
import type { OpenSheet } from "./open-sheets.ts";

// Lines of VW's "Ficha Técnica Novo Polo 200 TSI.pdf", as readPdfLines gives them.
const poloLines = [
  "Ficha Técnica Polo 1.0l TSI 94kW*",
  "Automático",
  "4 Portas",
  "MOTOR",
  "Cilindrada (cm³) 999",
  "N° de cilindros / disposição / válvulas por cilindro 3 / Em linha / 4",
  "Potência máxima - kW (cv) / rpm (NBR ISO 1585) 85 (116) / 5500 94 (128) / 5500",
  "Torque máximo - Nm (kgfm) / rpm (NBR ISO 1585) 200 (20,4) / 2000-3500 200 (20,4) / 2000-3500",
  "DIMENSÕES EXTERNAS (mm)",
  "Comprimento 4057",
  "Largura (sem espelho retrovisor) 1751",
  "Largura (com espelho retrovisor) 1964",
  "Altura (teto) 1468",
  "2565",
  "Distância entre eixos",
  "CAPACIDADES (litros)",
  "Porta-malas 300",
  "Tanque de combustível 52",
  "PESOS (kg)",
  "Em ordem de marcha 1147",
  "DESEMPENHO",
  "Aceleração 0-100 km/h (s) 10,1 9,6",
  "Velocidade máxima (km/h) 187 192",
  "Dados Oficiais: 01/Setembro/2017",
];
const poloLink = {
  model: "Novo Polo",
  title: "Polo Highline",
  pdf: "https://cdn/Ficha Técnica Novo Polo 200 TSI.pdf",
  file: "ficha-tecnica-novo-polo-200-tsi.pdf",
  page: "https://www.vwnews.com.br/cars/version/6/20",
};

// Rows of Renault's "FICHA TÉCNICA DUSTER 2026" spreadsheet: a column per version.
const dusterRows = [
  ["FICHA TÉCNICA DUSTER 2026", "", "", "", ""],
  ["", "Intense Plus 1.6 MT", "Intense Plus 1.6 CVT", "Iconic Plus 1.6 CVT", "Iconic Plus 1.3 TURBO"],
  ["Motor", "Aspiração natural, quatro cilindros em linha, 16 válvulas", "", "", "Turbocomprimido, quatro cilindros em linha, 16 válvulas"],
  ["Cilindrada", "1.598 cm³", "", "", "1.332 cm³"],
  ["Potência máxima (ABNT)", "109 cv (gasolina) @ 5.500 rpm", "", "", "156 cv (gasolina) @ 5.500 rpm"],
  ["", "112 cv (etanol) @ 5.500 rpm", "", "", "163 cv (etanol) @ 5.500 rpm"],
  ["Câmbio", "Manual de 5 velocidades", "Automático CVT", "", "Automático CVT"],
  ["Porta-malas", "475 L", "", "", ""],
  ["Peso em ordem de marcha (kg)", "1256", "1289", "1292", "1353"],
  ["Comprimento", "4376mm", "", "", ""],
  ["Aceleração 0 - 100 km/h", "11,5 (gasolina)", "13,1 (gasolina)", "", "9,5 s (gasolina)"],
  ["", "11,4 s (etanol)", "12,9 (etanol)", "", "9,5 s (etanol)"],
];
const dusterLink = { vehicle: "Duster", excel: "https://storage/duster.xlsx", file: "19-duster-pt.xlsx", page: "https://imprensa/duster" };

const sheet = (fields: Partial<OpenSheet>): OpenSheet => ({
  brand: "renault",
  line: "Duster",
  title: "Duster",
  trims: [],
  years: [2026, 2027],
  electric: false,
  page: "",
  url: "",
  file: "a.xlsx",
  specs: { powerCv: 112 },
  ...fields,
});
const target = { brand: "Renault", family: "DUSTER", modelYear: 2026, turbo: false, electric: false };

describe("open press room sheets", () => {
  it("reads a VW sheet, with the unit of its section and a value above its label", () => {
    const read = vwSheet(poloLines, poloLink)!;
    expect(read.specs).toEqual({
      powerCv: 128,
      torqueKgfm: 20.4,
      weightKg: 1147,
      lengthMm: 4057,
      widthMm: 1751,
      heightMm: 1468,
      wheelbaseMm: 2565,
      trunkLiters: 300,
      tankLiters: 52,
      topSpeedKmh: 192,
      zeroTo100s: 9.6,
    });
    expect(read).toMatchObject({
      line: "Novo Polo",
      trims: ["highline"],
      years: [2017, 2018],
      engineLiters: 1,
      valves: 12,
      turbo: true,
      transmission: "automatico",
    });
  });

  it("reads a Renault spreadsheet's columns, an empty cell repeating the one on its left", () => {
    const read = renaultSheets(dusterRows, dusterLink, undefined);
    expect(read.map((item) => [item.title, item.engineLiters, item.turbo, item.transmission, item.specs.powerCv, item.specs.weightKg])).toEqual([
      ["DUSTER 2026 · Intense Plus 1.6 MT", 1.6, false, "manual", 112, 1256],
      ["DUSTER 2026 · Intense Plus 1.6 CVT", 1.6, false, "automatico", 112, 1289],
      ["DUSTER 2026 · Iconic Plus 1.6 CVT", 1.6, false, "automatico", 112, 1292],
      // The column does not name the gearbox; its row does.
      ["DUSTER 2026 · Iconic Plus 1.3 TURBO · automático", 1.3, true, "automatico", 163, 1353],
    ]);
    expect(read[0]!.specs).toMatchObject({ trunkLiters: 475, lengthMm: 4376, zeroTo100s: 11.4 });
    expect(read[0]!.years).toEqual([2026, 2027]);
  });

  it("reads units in meters, in the label, and dimensions written together", () => {
    expect(
      specsOfFields([
        { label: "Comprimento", text: "4,74 metros" },
        { label: "Largura / Largura com retrovisores", text: "1.639 mm / 1.940 mm" },
        { label: "Porta-malas (litros)", text: "317" },
        { label: "Dimensões", text: "4.379 mm de comprimento, 1.813 mm de largura e 2.673 mm de entre-eixos" },
        { label: "Aceleração 0 a 100 km/h", text: "80 km/h" },
      ]),
    ).toEqual({ lengthMm: 4740, widthMm: 1639, wheelbaseMm: 2673, trunkLiters: 317 });
    expect([litersOf("1.598 cm³"), litersOf("999 cm³"), litersOf("Polo 1.0l TSI"), litersOf("1.6 16V")]).toEqual([1.6, 1, 1, 1.6]);
  });

  it("matches by line, years, engine and gearbox, preferring the version's trim", () => {
    const sheets = [
      sheet({ title: "Duster · Intense Plus 1.6 MT", trims: ["intense", "plus"], engineLiters: 1.6, transmission: "manual" }),
      sheet({ title: "Duster · Iconic Plus 1.6 CVT", trims: ["iconic", "plus"], engineLiters: 1.6, transmission: "automatico" }),
      sheet({ title: "Duster · Iconic Plus 1.3 TURBO", trims: ["iconic", "plus"], engineLiters: 1.3, turbo: true, transmission: "automatico" }),
      sheet({ line: "Duster Oroch", title: "Duster Oroch", engineLiters: 1.6, years: [2016, 2017] }),
    ];
    const of = (name: string, fields: Partial<typeof target> & { engineLiters?: number } = {}) =>
      openSheetOfVersion(sheets, { ...target, name, ...fields })?.title;
    expect(of("DUSTER Intense Plus 1.6 16V Flex Mec.", { engineLiters: 1.6 })).toBe("Duster · Intense Plus 1.6 MT");
    expect(of("DUSTER Iconic Plus 1.6 16V Flex Aut.", { engineLiters: 1.6 })).toBe("Duster · Iconic Plus 1.6 CVT");
    expect(of("DUSTER Iconic Plus 1.3 TB 16V Flex Aut.", { engineLiters: 1.3, turbo: true })).toBe("Duster · Iconic Plus 1.3 TURBO");
    // Another year, a manual where the sheet is automatic, or the Oroch: no sheet of the Duster.
    expect(of("DUSTER Iconic Plus 1.6 16V Flex Aut.", { engineLiters: 1.6, modelYear: 2023 })).toBeUndefined();
    expect(of("DUSTER Iconic 1.3 TB 16V Flex Mec.", { engineLiters: 1.3, turbo: true })).toBeUndefined();
    expect(of("DUSTER OROCH Dyna. 1.6 Flex 16V Mec.", { engineLiters: 1.6 })).toBeUndefined();
    expect(of("DUSTER OROCH Dyna. 1.6 Flex 16V Mec.", { engineLiters: 1.6, modelYear: 2016 })).toBe("Duster Oroch");
  });

  it("keeps only the shared figures of sheets that fit as well, and a cab's sheet for that cab", () => {
    const kwid = [
      sheet({ line: "Kwid", title: "Kwid · Zen · manual", trims: ["zen"], specs: { powerCv: 71, weightKg: 818 } }),
      sheet({ line: "Kwid", title: "Kwid · Intense · manual", trims: ["intense"], specs: { powerCv: 71, weightKg: 820 } }),
    ];
    const kwidTarget = { ...target, family: "KWID" };
    expect(openSheetOfVersion(kwid, { ...kwidTarget, name: "KWID Zen 1.0 Flex 12V 5p Mec." })?.specs).toEqual({ powerCv: 71, weightKg: 818 });
    const either = openSheetOfVersion(kwid, { ...kwidTarget, name: "KWID Techno 1.0 12V 5p Mec." });
    expect([either?.title, either?.specs]).toEqual(["Kwid · Zen / Intense · manual", { powerCv: 71 }]);

    const saveiro = [sheet({ brand: "vw", line: "Saveiro", title: "Saveiro Cross", cab: "cd", valves: 16 })];
    const saveiroTarget = { ...target, brand: "VW - VolksWagen", family: "Saveiro" };
    expect(openSheetOfVersion(saveiro, { ...saveiroTarget, name: "Saveiro CROSS 1.6 T.Flex 16V CD", valves: 16 })?.title).toBe("Saveiro Cross");
    expect(openSheetOfVersion(saveiro, { ...saveiroTarget, name: "Saveiro Robust 1.6 Total Flex 8V", valves: 8 })).toBeUndefined();
    expect(openSheetOfVersion(saveiro, { ...saveiroTarget, name: "Saveiro Pepper 1.6 Flex 16V CE", valves: 16 })).toBeUndefined();
  });
});
