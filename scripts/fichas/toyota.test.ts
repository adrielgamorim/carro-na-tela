import { describe, expect, it } from "vitest";
import { assignColumns, toyotaLine, toyotaSheets, toyotaYear } from "./toyota.ts";
import type { PdfTextLine } from "../inmetro/pbev.ts";

const cell = (center: number, text: string) => ({ center, left: center - 20, right: center + 20, y: 0, text });
// The Hilux 2024's version columns: Chassi … SRX Plus, GR-Sport.
const columns = [311, 412, 514, 616, 718, 820, 922, 1025];

describe("Toyota sheets", () => {
  it("splits a row's columns among its merged cells, each centered over its run", () => {
    // "204 / 3.400" over the first seven, "224 / 3.000" over the GR-Sport.
    expect(assignColumns([cell(616, "204"), cell(1025, "224")], columns)).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    // "42,8" over Chassi … STD Power Pack, "50,9" over SR … SRX Plus, "55,0" over the GR-Sport.
    expect(assignColumns([cell(412, "42,8"), cell(769, "50,9"), cell(1025, "55,0")], columns)).toEqual([0, 0, 0, 1, 1, 1, 1, 2]);
    // A cell per column: each its own.
    expect(assignColumns(columns.map((x) => cell(x, String(x))), columns)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("knows the line and the model year from the file's name and title", () => {
    expect(toyotaLine("2024-04-corolla-cross-2025-ficha-tecnica.pdf")).toBe("Corolla Cross");
    expect(toyotaLine("2020-11-ficha-tecnica-sw4-my22.pdf")).toBe("Hilux SW4");
    expect(toyotaLine("2022-01-ficha-tecnica-yaris-seda-2023.pdf")).toBe("Yaris Sedan");
    expect(toyotaYear("SW4 MY'22 - DESCRIÇÃO DOS EQUIPAMENTOS", "x.pdf")).toBe(2022);
    expect(toyotaYear("", "2020-11-hilux-2021-ficha-tecnica.pdf")).toBe(2021);
    expect(toyotaYear("", "2021-03-corolla-cross-ficha-tecnica.pdf")).toBe(2021);
  });

  it("reads a version's figures from its column, a value on the line above its label", () => {
    const line = (y: number, cells: [number, string][]): PdfTextLine => ({
      page: 1,
      y,
      cells: cells.map(([center, text]) => ({ center, width: text.length * 4, text })),
    });
    const lines = [
      line(741, [[600, "Hilux 2024 - Ficha Técnica"]]),
      line(697, [[360, "Cabine Simples"], [770, "Cabine Dupla"]]),
      line(696, [[140, "Carroceria"]]),
      line(685, [[136, "Versão"], [311, "Chassi MT"], [718, "SR AT"], [1025, "GR-Sport AT"]]),
      line(662, [[134, "Motor"], [668, "2.8L 16V Turbo Intercooler"]]),
      line(651, [[514, "204 / 3.400"]]),
      line(650, [[150, "Potência (cv/rpm)"], [1025, "224 / 3.000"]]),
      line(600, [[3085, ""], [668, "3.085"]]),
      line(599, [[150, "Entre eixos (mm)"]]),
    ];
    const sheets = toyotaSheets(lines, { file: "2024-08-ficha-tecnica-hilux-2024-2.pdf", url: "x" });
    expect(sheets.map((sheet) => [sheet.title, sheet.specs.powerCv, sheet.specs.wheelbaseMm, sheet.cab, sheet.transmission])).toEqual([
      ["Hilux 2024 · Chassi MT", 204, 3085, "cs", "manual"],
      ["Hilux 2024 · SR AT", 204, 3085, "cd", "automatico"],
      ["Hilux 2024 · GR-Sport AT", 224, 3085, "cd", "automatico"],
    ]);
    expect(sheets[2]!.trims).toEqual(["gr", "sport", "grs"]);
  });
});
