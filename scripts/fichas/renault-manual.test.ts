import { describe, expect, it } from "vitest";
import type { PdfTextLine } from "../inmetro/pbev.ts";
import { manualLine, manualYears } from "./fetch-manuais.ts";
import { renaultManualSheets } from "./renault-manual.ts";

// A page's lines from [y, [text, center]…], as the PDF reader gives them.
const page = (number: number, rows: [number, [string, number][]][]): PdfTextLine[] =>
  rows.map(([y, cells]) => ({ page: number, y, cells: cells.map(([text, center]) => ({ text, center, width: text.length * 4 })) }));
const source = { line: "Sandero", years: [2015, 2015] as [number, number], url: "https://cdn/x.pdf", page: "https://www.renault.com.br/manuais/sandero.html", file: "renault/x.pdf" };

// The Sandero 2015's chapter, cut down: two engines, one in two gearboxes.
const engines = page(147, [
  [399, [["CARACTERÍSTICAS DOS MOTORES", 132]]],
  [377, [["1.0 16V Flex", 270], ["1.6 8V Flex", 378], ["1.6 8V Flex", 485]]],
  [370, [["Versões", 49]]],
  [363, [["Manual", 270], ["Manual", 378], ["Automatizado", 486]]],
  [344, [["Tipo de motor", 62], ["D4D", 270], ["K7M", 377], ["K7M", 485]]],
  [328, [["Cilindrada", 54], ["(cm³)", 89], ["998", 270], ["1.598", 378], ["1.598", 485]]],
  [244, [["10,2 @ 4.250", 270], ["14,5 @ 2.850", 378], ["14,5 @ 2.850", 485]]],
  [242, [["Torque máximo", 65], ["(m.kgf @ rpm)", 129]]],
  [232, [["Gasolina / Etanol", 68]]],
  [230, [["10,5 @ 4.250", 270], ["15,5 @ 2.850", 378], ["15,5 @ 2.850", 485]]],
  [213, [["Potência máxima", 68], ["(cv @ rpm)", 130]]],
  [208, [["77 / 80 @ 6.000", 270], ["98 / 106 @ 5.250", 378], ["98 / 106 @ 5.250", 485]]],
]);
const dimensions = page(148, [
  [399, [["DIMENSÕES (em metros)", 100], ["(1/2)", 187]]],
  [238, [["0,812", 77], ["2,589", 196], ["0,656", 316]]],
  [216, [["1,994", 446]]],
  [209, [["4,057", 196]]],
]);
const weights = page(150, [
  [399, [["PESOS (em kg)", 72]]],
  [382, [["Os pesos indicados se referem a um veículo básico e sem opcionais: eles podem variar", 283]]],
  [348, [["1.0 16V", 241], ["1.6 8V", 307], ["1.6 8V Cross", 373], ["1.6 8V", 439]]],
  [341, [["Versões", 49]]],
  [334, [["Manual", 241], ["Manual", 307], ["Manual", 373], ["Automatizado", 439]]],
  [317, [["Massa do veículo vazio (tara)", 94]]],
  [312, [["1.013", 241], ["1.063", 307], ["1.105", 373], ["1.070", 439]]],
  [307, [["em ordem de marcha, sem motorista", 110]]],
  [284, [["Massa máxima autorizada (massa bruta)", 118], ["1.510", 241], ["1.530", 307], ["1.565", 373], ["1.535", 439]]],
]);

describe("Renault's owner's manuals", () => {
  it("reads a sheet per engine and gearbox, with the weight of the version that names nothing else", () => {
    const sheets = renaultManualSheets([...engines, ...dimensions, ...weights], source);
    expect(sheets.map((sheet) => [sheet.title, sheet.engineLiters, sheet.valves, sheet.transmission, sheet.specs])).toEqual([
      ["Sandero 1.0 16V Flex Manual (manual 2015)", 1, 16, "manual", { powerCv: 80, torqueKgfm: 10.5, weightKg: 1013, lengthMm: 4057, wheelbaseMm: 2589 }],
      // Not the Cross's 1,105 kg.
      ["Sandero 1.6 8V Flex Manual (manual 2015)", 1.6, 8, "manual", { powerCv: 106, torqueKgfm: 15.5, weightKg: 1063, lengthMm: 4057, wheelbaseMm: 2589 }],
      ["Sandero 1.6 8V Flex Automatizado (manual 2015)", 1.6, 8, "automatico", { powerCv: 106, torqueKgfm: 15.5, weightKg: 1070, lengthMm: 4057, wheelbaseMm: 2589 }],
    ]);
    expect(sheets[0]).toMatchObject({ brand: "renault", line: "Sandero", trims: [], years: [2015, 2015], turbo: false, electric: false });
  });

  it("reads torque in N.m and the power next to its engine speed", () => {
    const duster = page(222, [
      [393, [["Características dos motores", 119]]],
      [374, [["Versões", 159], ["1.3 TCe Flex", 490]]],
      [357, [["Tipo de motor", 90], ["H5H Turbo", 490]]],
      [341, [["Cilindrada", 82], ["(cm³)", 117], ["1.332", 490]]],
      [271, [["162 a 5.500 (gasolina)", 490]]],
      [264, [["Potência máxima", 97], ["(cv a rpm)", 157]]],
      [258, [["170 a 5.500 (etanol)", 490]]],
      [241, [["270 a 4000 (gasolina)", 490]]],
      [235, [["Torque máximo", 94], ["(Nm @ rpm)", 154]]],
    ]);
    const [sheet] = renaultManualSheets(duster, { ...source, line: "Duster" });
    expect(sheet).toMatchObject({ engineLiters: 1.3, turbo: true, specs: { powerCv: 170, torqueKgfm: 27.5 } });
  });

  it("reads the Master's diesel: thousands with a space, the cv in brackets after the kW", () => {
    const master = page(144, [
      [399, [["CARACTERÍSTICAS DO MOTOR", 120]]],
      [317, [["Cilindrada", 52], ["(cm", 84], [")", 96], ["2 299", 350]]],
      [295, [["Injeção", 45], ["Diesel", 350]]],
      [227, [["Potência (1)", 57], ["kW (cv) / rpm", 112], ["92 (125) / 3500", 350]]],
      [206, [["Torque (1)", 53], ["Nm / rpm", 96], ["310 / 1500", 350]]],
    ]);
    const [sheet] = renaultManualSheets(master, { ...source, line: "Master" });
    expect(sheet).toMatchObject({ engineLiters: 2.3, diesel: true, specs: { powerCv: 125, torqueKgfm: 31.6 } });
    // A diesel's turbo is left open.
    expect(sheet?.turbo).toBeUndefined();
  });

  it("gives an engine over several versions only the words they share, and no gearbox", () => {
    const duster = page(167, [
      [399, [["CARACTERÍSTICAS DOS MOTORES", 132]]],
      [375, [["2.0 16V 4x2", 417]]],
      [370, [["Versão", 46], ["1.6 16V 4x2", 256], ["2.0 16V 4x2", 337], ["2.0 16V 4x4", 498]]],
      [365, [["Automático", 417]]],
      [328, [["Cilindrada", 54], ["(cm³)", 89], ["1.598", 256], ["1.998", 417]]],
      [215, [["Potência máxima", 68], ["(cv / rpm)", 127]]],
      [210, [["110 - 115 / 5.750", 256], ["143 - 148 / 5.750", 417]]],
    ]);
    const sheets = renaultManualSheets(duster, { ...source, line: "Duster" });
    expect(sheets.map((sheet) => [sheet.title, sheet.transmission, sheet.specs.powerCv])).toEqual([
      ["Duster 1.6 16V 4x2 (manual 2015)", undefined, 115],
      ["Duster 2.0 16V 4x2 (manual 2015)", undefined, 148],
    ]);
  });

  it("reads the older manuals: the unit's exponent apart, a value a few points below its row", () => {
    // The Logan 2010's: "3" of "(cm³)" a cell of its own, the 1.0's "998" 4 points lower.
    const logan = page(121, [
      [383, [["CARACTERÍSTICAS DOS MOTORES", 122]]],
      [365, [["Versões", 47], ["1.0 16V Flex", 277], ["1.6 8V Flex", 423]]],
      [326, [["Cilindrada (cm )", 63], ["3", 93], ["1598", 423]]],
      [322, [["998", 277]]],
      [280, [["Potência máxima", 65], ["cv", 100], ["Gasolina/álcool (RPM)", 145], ["76 / 77 (5850 RPM)", 275], ["92 /95 (5250 RPM)", 422]]],
      [262, [["Torque máximo", 62], ["Nm", 96], ["( mkg ) / RPM", 125], ["97,3 (9,92) a 4350 RPM", 275], ["134,0 (13.7) a 2850 RPM", 422]]],
      [249, [["Gasolina/álcool", 62], ["99,0 (10,1) a 4350 RPM", 275], ["138,0 (14.1) a 2850 RPM", 422]]],
    ]);
    const sheets = renaultManualSheets(logan, { ...source, line: "Logan", years: [2010, 2010] });
    expect(sheets.map((sheet) => [sheet.title, sheet.engineLiters, sheet.specs])).toEqual([
      ["Logan 1.0 16V Flex (manual 2010)", 1, { powerCv: 77, torqueKgfm: 10.1 }],
      ["Logan 1.6 8V Flex (manual 2010)", 1.6, { powerCv: 95, torqueKgfm: 14.1 }],
    ]);
  });

  it("joins the small capitals and the thousands set apart (the Fluence 2010's)", () => {
    // [text, left, width]: "c" touching "ilindrada", "1" a point off "998".
    const line = (y: number, cells: [string, number, number][]): PdfTextLine => ({
      page: 183,
      y,
      cells: cells.map(([text, left, width]) => ({ text, center: left + width / 2, width })),
    });
    const fluence = [
      line(399, [["c", 30, 6], ["aracterísticas dos motores", 36, 180]]),
      line(372, [["v", 30, 6], ["ersões", 36, 40], ["2.0 16", 330, 20], ["v", 350, 5], ["Hi-", 357.5, 10], ["f", 367.5, 3], ["lex", 370.5, 10]]),
      line(309, [["c", 30, 6], ["ilindrada", 36, 40], ["(cm )", 78, 20], ["1", 348, 5], ["998", 354, 15]]),
      line(280, [["Potência* cv (kw)", 30, 80], ["140 (103)", 345, 30]]),
      line(232, [["t", 30, 4], ["orque do motor* mkg", 34, 90], ["19,9", 352, 16]]),
    ];
    const sheets = renaultManualSheets(fluence, { ...source, line: "Fluence", years: [2010, 2010] });
    expect(sheets.map((sheet) => [sheet.title, sheet.engineLiters, sheet.valves, sheet.specs])).toEqual([
      ["Fluence 2.0 16v Hi-flex (manual 2010)", 2, 16, { powerCv: 140, torqueKgfm: 19.9 }],
    ]);
  });

  it("takes the years and the line from the manual's path", () => {
    expect(manualYears("manuais/manuais-sandero/2015/NU1192-3-B52-PTB.pdf")).toEqual([2015, 2015]);
    expect(manualYears("editorial/2023/manuais/agosto/manual-proprietario-oroch-2023.pdf")).toEqual([2023, 2023]);
    // Published in June 2024: that year's model or the next's.
    expect(manualYears("editorial/2024/manual/duster/junho/Manual-Duster-.pdf")).toEqual([2024, 2025]);
    expect(manualYears("editorial/manuais-propietario21/Nova-Duster_compressed.pdf")).toEqual([2021, 2022]);
    expect(manualYears("editorial/manuais/manual-do-proprietario-2020-2021.pdf")).toEqual([2020, 2021]);
    expect(manualYears("editorial/manuais/NU1154-8-X79-PTB.pdf")).toBeUndefined();
    // The Duster's manual on the Oroch's page is the Duster's.
    expect(manualLine("editorial/manuais/manuais-duster/2018/NU1154-8-X79-PTB.pdf", "oroch")).toBe("Duster");
    expect(manualLine("editorial/manuais/2021/Manual-duster-oroch-H79-PTB-2018.pdf", "oroch")).toBe("Duster Oroch");
    expect(manualLine("editorial/2023/manuais/agosto/Kwid-E-Tech.pdf", "kwid-e-tech")).toBeUndefined();
  });
});
