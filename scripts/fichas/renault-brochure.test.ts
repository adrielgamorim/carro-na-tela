import { describe, expect, it } from "vitest";
import type { PdfTextLine } from "../inmetro/pbev.ts";
import { brochureColumns, brochureFile, brochureYear, renaultBrochureEquipment } from "./renault-brochure.ts";

// [y, ...[left, text]]: a page of the brochure, a line per entry, 4 points a character.
const page = (rows: [number, ...[number, string][]][]): PdfTextLine[] =>
  rows.map(([y, ...cells]) => ({
    page: 2,
    y,
    cells: cells.map(([left, text]) => ({ center: left + text.length * 2, width: text.length * 4, text })),
  }));

// The Duster's: two lines of names, an item per line, marks a point under or on its line.
const duster = page([
  [545, [40, "lista de equipamentos"]],
  [516, [434, "Intense Plus"], [545, "Iconic Plus"]],
  [507, [434, "1.6 MT/CVT"], [545, "1.6 CVT"]],
  [494, [40, "SEGURANÇA"]],
  [483, [40, "6 airbags (frontal, laterais e de cortina)"]],
  [482, [434, "•"], [545, "•"]],
  [471, [40, "Alarme perimétrico"]],
  [470, [434, "•"], [545, "•"]],
  [460, [40, "Câmera de ré"], [545, "–"]],
  [459, [434, "•"]],
  [449, [40, "Sensor de ponto cego"]],
  [448, [434, "–"], [545, "•"]],
  [436, [40, "TECNOLOGIA E CONECTIVIDADE"]],
  [424, [40, "6 alto-falantes"]],
  [423, [434, "•"], [545, "•"]],
  [412, [40, "Pack Outsider"], [545, "O"]],
  [411, [434, "–"]],
  [31, [46, "•"], [75, "= série | O = opcional"]],
]);

// The Kardian's: lowercase groups, names over two lines around their marks, items 37 points apart.
const kardian = page([
  [5397, [343, "equipamentos"]],
  [5194, [454, "evolution"], [694, "techno"]],
  [5157, [40, "design exterior"]],
  [5120, [40, "aerofólio traseiro"]],
  [5117, [456, "•"], [696, "•"]],
  [5083, [40, "alargador de para-lamas"]],
  [5080, [456, "•"], [696, "•"]],
  [4964, [40, "barras de teto modulares"]],
  [4951, [454, "-"], [696, "•"]],
  [4944, [40, "em prata acetinado"]],
  [4907, [40, "Media Nav com Android Auto,"]],
  [4894, [456, "•"], [694, "•"]],
  [4887, [40, "integradas ao"]],
  [4860, [40, "multimídia"]],
  [4800, [40, "design interior"]],
  [4760, [40, "maçanetas internas"]],
  [4757, [456, "•"], [696, "•"]],
]);

describe("Renault brochures", () => {
  it("names the file and finds its year", () => {
    const url = "https://cdn.group.renault.com/ren/br/x/2024/catalogos/kardian/marco/Catalogo-Kardian-mar24.pdf.asset.pdf/7560ab8ca2.pdf";
    expect(brochureFile(url)).toBe("catalogo-kardian-mar24.pdf");
    expect(brochureYear(url)).toBe(2024);
    expect(brochureYear("https://x/catalogos/catalogo-af-RMA002621-Folh-Duster-MARCO-2021.pdf.asset.pdf/e1.pdf")).toBe(2021);
    expect(brochureYear("https://x/catalogos/AF_RMA003424A_Catalogo_Kangoo-24.pdf")).toBe(2024);
    expect(brochureFile("https://www.renault.com.br/veiculos/kangoo.html")).toBeUndefined();
  });

  it("reads a table of an item per line, the marks under or on it", () => {
    const [intense, iconic] = brochureColumns(duster);
    expect(intense).toMatchObject({
      name: "Intense Plus 1.6 MT/CVT",
      groups: [
        { name: "Segurança", items: ["6 airbags (frontal, laterais e de cortina)", "Alarme perimétrico", "Câmera de ré"] },
        { name: "Tecnologia e conectividade", items: ["6 alto-falantes"] },
      ],
    });
    expect(iconic?.groups.at(-1)).toEqual({ name: "Tecnologia e conectividade", items: ["6 alto-falantes", "Pack Outsider (opcional)"] });
  });

  it("joins the lines of an item and tells them from a group", () => {
    const [evolution, techno] = brochureColumns(kardian);
    expect(evolution?.groups).toEqual([
      { name: "Design exterior", items: ["aerofólio traseiro", "alargador de para-lamas", "Media Nav com Android Auto, integradas ao multimídia"] },
      { name: "Design interior", items: ["maçanetas internas"] },
    ]);
    expect(techno?.groups[0]?.items).toContain("barras de teto modulares em prata acetinado");
  });

  it("keys each column like the spreadsheets' lists", () => {
    const link = { vehicle: "Duster", brochure: "https://x/2025/catalogo/AF-Catalogo-Duster-JAN.pdf.asset.pdf/b6.pdf", page: "p" };
    const [intense, iconic] = renaultBrochureEquipment(duster, link);
    expect(intense).toMatchObject({ line: "Duster", trims: ["intense", "plus"], years: [2025, 2026], engineLiters: 1.6 });
    expect(intense?.transmission).toBeUndefined();
    expect(iconic).toMatchObject({ trims: ["iconic", "plus"], transmission: "automatico", file: "af-catalogo-duster-jan.pdf" });
  });
});
