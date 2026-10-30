import { describe, expect, it } from "vitest";
import { hyundaiCatalog, hyundaiDimensions, hyundaiFileTrims, hyundaiTable, hyundaiYear } from "./hyundai.ts";
import type { PdfTextLine } from "../inmetro/pbev.ts";

// The end of "catalogo-digital-novo-hb20-platinum-2024.pdf", a line per row.
const rows = [
  "Novo HB20 Platinum",
  "Ficha técnica",
  "Motor | Kappa 1.0L TGDI 12V Flex",
  "Transmissão",
  "Automático de seis velocidades",
  "Potência máxima (cv)",
  "120 (E) | 120 (G) @ 6.000 rpm",
  "Torque máximo (kgf.m)",
  "17,5 (E) | 17,5 (G) @ 1.500 rpm",
  "Velocidade máxima (km/h)",
  "190 (E) | 190 (G)",
  "Aceleração de 0 a 100 km/h (s)",
  "10,7 (E) | 10,7 (G)",
  "E: Etanol. G: Gasolina.",
  "Válida para veículos com ano de fabricação/modelo 2023/2024.",
  "Dimensões",
  "Volume do porta-malas (VDA)",
  "1.720 mm | 300 litros | 930 litros (banco rebatido)",
  "2.530 mm",
  "4.015 mm",
  "1.470 mm",
  "Lista de equipamentos",
  "Segurança",
  "Seis airbags: frontal duplo, laterais de tórax e laterais de cortina",
  "Câmera de ré",
  "Conforto e conveniência",
  "Vidros elétricos dianteiros e traseiros com one touch (descida e subida) e",
  "antiesmagamento",
  "Click to buy",
];
const pdf: PdfTextLine[] = rows.map((row, index) => ({
  page: 1,
  y: 1000 - index * 10,
  cells: row.split(" | ").map((text, cell) => ({ center: 100 + cell * 200, text })),
}));

describe("Hyundai catalogs", () => {
  it("reads the year, the version from the name, and the dimensions without labels", () => {
    expect(hyundaiYear(rows, "x.pdf")).toBe(2024);
    expect(hyundaiYear([], "catalogo-digital-novo-hb20-platinum-26-27.pdf")).toBe(2027);
    expect(hyundaiFileTrims("catalogo-digital-novo-hb20-comfort-plus-tech-tgdi-2025-janeiro.pdf", "hb20")).toEqual(["comfort", "plus", "tech"]);
    expect(hyundaiDimensions(rows.slice(15, 21))).toEqual({
      lengthMm: 4015,
      wheelbaseMm: 2530,
      widthMm: 1720,
      heightMm: 1470,
      trunkLiters: 300,
    });
  });

  it("gives a catalog's sheet and equipment list for its one version", () => {
    const { sheet, list } = hyundaiCatalog(pdf, { file: "catalogo-digital-novo-hb20-platinum-2024.pdf", url: "x" });
    expect(sheet).toMatchObject({
      brand: "hyundai",
      line: "HB20",
      title: "HB20 2024 · HB20 Platinum",
      trims: ["platinum"],
      years: [2024, 2024],
      engineLiters: 1,
      turbo: true,
      transmission: "automatico",
      specs: { powerCv: 120, torqueKgfm: 17.5, topSpeedKmh: 190, zeroTo100s: 10.7, lengthMm: 4015, trunkLiters: 300 },
    });
    expect(list?.groups).toEqual([
      { name: "Segurança", items: ["Seis airbags: frontal duplo, laterais de tórax e laterais de cortina", "Câmera de ré"] },
      {
        name: "Conforto e conveniência",
        items: ["Vidros elétricos dianteiros e traseiros com one touch (descida e subida) e antiesmagamento"],
      },
    ]);
  });
});

// The Creta 25/26's table: rows labeled on the left, the engine in merged cells over the columns.
const table = [
  [805, [40, "LISTA DE EQUIPAMENTOS"]],
  [793, [40, "MOTOR"], [350, "Kappa 1.0 Turbo GDI"], [500, "Gamma 1.6 Turbo GDI"]],
  [778, [40, "VERSÃO"], [320, "Comfort"], [400, "N Line"], [500, "Ultimate"]],
  [761, [40, "TRANSMISSÃO"], [320, "Automática"], [400, "Automática"], [490, "Automatizada"]],
  [743, [40, "ANO MODELO"], [320, "25/26"], [400, "25/26"], [490, "25/26"]],
  [729, [40, "ESTILO EXTERIOR"]],
  [720, [40, "Grade frontal cinza"], [326, "●"], [406, "-"], [506, "●"]],
  [711, [40, "Grade frontal N Line"], [326, "-"], [406, "●"], [506, "-"]],
  [702, [40, "Faróis em LED"], [326, "-"], [406, "●"], [506, "●"]],
  [693, [40, "Lanternas em LED"], [326, "-"], [406, "●"], [506, "●"]],
  [684, [40, "Luzes diurnas em LED"], [326, "●"], [406, "●"], [506, "●"]],
] as [number, ...[number, string][]][];
const tablePdf: PdfTextLine[] = table.map(([y, ...cells]) => ({
  page: 1,
  y,
  cells: cells.map(([left, text]) => ({ center: left + text.length * 2, width: text.length * 4, text })),
}));

describe("Hyundai's equipment tables", () => {
  it("gives each version column its items and the engine over it", () => {
    const lists = hyundaiTable(tablePdf, { file: "ficha-tecnica-equipamentos-novo-creta-25-26-ultimate.pdf", url: "x" });
    expect(lists.map((list) => [list.title, list.trims, list.engineLiters, list.years])).toEqual([
      ["Creta 2026 · Comfort Kappa 1.0 Turbo GDI", ["comfort"], 1, [2026, 2026]],
      ["Creta 2026 · N Line Kappa 1.0 Turbo GDI", ["n", "line"], 1, [2026, 2026]],
      ["Creta 2026 · Ultimate Gamma 1.6 Turbo GDI", ["ultimate"], 1.6, [2026, 2026]],
    ]);
    expect(lists[1]?.groups).toEqual([
      { name: "Estilo exterior", items: ["Grade frontal N Line", "Faróis em LED", "Lanternas em LED", "Luzes diurnas em LED"] },
    ]);
  });
});
