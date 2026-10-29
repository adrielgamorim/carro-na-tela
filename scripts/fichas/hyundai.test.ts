import { describe, expect, it } from "vitest";
import { hyundaiCatalog, hyundaiDimensions, hyundaiFileTrims, hyundaiYear } from "./hyundai.ts";
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
