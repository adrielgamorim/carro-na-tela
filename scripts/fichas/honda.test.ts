import { describe, expect, it } from "vitest";
import type { PdfTextLine } from "../inmetro/pbev.ts";
import { hondaBrochure, hondaLine, hondaYear } from "./honda.ts";

// [y, ...[center, text]]: the HR-V 2021's table, beside prose on the left of the page.
const rows: [number, ...[number, string][]][] = [
  [787, [691, "Altamente tecnológico, o"], [770, "HR-V Touring"]],
  [785, [2042, "ESPECIFICAÇÕES"], [2127, "LX"], [2210, "EX"], [2293, "EXL"], [2386, "Touring"]],
  [772, [2072, "Motor"], [2127, "1.8L 16V SOHC i-VTEC FlexOne"], [2210, "1.8L 16V SOHC i-VTEC FlexOne"], [2293, "1.8L 16V SOHC i-VTEC FlexOne"], [2391, "1.5L Turbo 16V DOHC"]],
  [763, [2040, "Potência (cv)"], [2127, "140"], [2210, "140"], [2293, "140"], [2391, "173"]],
  [745, [2040, "Transmissão automática do tipo CVT"], [2127, "•"], [2210, "•"], [2293, "•"], [2391, "•"]],
  [727, [2042, "Suspensão dianteira - MacPherson"], [2127, "•"], [2210, "•"], [2293, "•"], [2391, "•"]],
  [700, [1016, "Para sua total conveniência, possui também"], [2027, "Direção com assistência elétrica progressiva (EPS)"], [2127, "•"], [2210, "•"], [2293, "•"], [2391, "•"]],
  [690, [2058, "Comprimento (mm)"], [2127, "4.329"], [2210, "4.329"], [2293, "4.329"], [2391, "4.329"]],
  [680, [2050, "SEGURANÇA"]],
  [672, [2040, "Câmera de ré multivisão"], [2127, "-"], [2210, "•"], [2293, "•"], [2391, "•"]],
  // The WR-V 2021's: a version's value a point above the others' (merged as one line).
  [663, [2040, "Faróis de neblina"], [2210, "em LED"]],
  [662, [2127, "•"], [2293, "em LED"], [2391, "em LED"]],
  [650, [2040, "6) O ajuste automático dos faróis pode não funcionar."], [2127, "•"]],
  [640, [1900, "CORES"]],
  [632, [2040, "Branco Tafetá"], [2127, "•"], [2210, "•"], [2293, "•"], [2391, "•"]],
];
const pdf: PdfTextLine[] = rows.map(([y, ...cells]) => ({
  page: 3,
  y,
  cells: cells.map(([center, text]) => ({ center, width: text.length * 4, text })),
}));

describe("Honda brochures", () => {
  it("names the line and the year from the file or the table's title", () => {
    expect(hondaLine("honda-campanha-hrv2021-folheto-simples.pdf")).toBe("HR-V");
    expect(hondaLine("catalogo-produto-city-hatch-2024.pdf")).toBe("City Hatchback");
    expect(hondaLine("Principais Especificações Honda Fit")).toBe("Fit");
    expect(hondaYear("honda-campanha-hrv2021-folheto.pdf")).toBe(2021);
    expect(hondaYear("especificacoes.pdf", "Honda City - 2014")).toBe(2014);
  });

  it("gives each version its sheet and equipment", () => {
    const { sheets, lists } = hondaBrochure(pdf, { file: "honda-campanha-hrv2021-folheto-simples.pdf", url: "x" });
    expect(sheets.map((sheet) => [sheet.trims, sheet.engineLiters, sheet.turbo, sheet.transmission, sheet.years])).toEqual([
      [["lx"], 1.8, false, "automatico", [2021, 2022]],
      [["ex"], 1.8, false, "automatico", [2021, 2022]],
      [["exl"], 1.8, false, "automatico", [2021, 2022]],
      [["touring"], 1.5, true, "automatico", [2021, 2022]],
    ]);
    expect(sheets[3]?.specs).toEqual({ powerCv: 173, lengthMm: 4329 });
    expect(lists[0]?.groups).toEqual([
      { name: "Equipamentos", items: ["Transmissão automática do tipo CVT", "Direção com assistência elétrica progressiva (EPS)"] },
      { name: "Segurança", items: ["Faróis de neblina"] },
    ]);
    expect(lists[1]?.groups[1]).toEqual({ name: "Segurança", items: ["Câmera de ré multivisão", "Faróis de neblina: em LED"] });
  });
});
