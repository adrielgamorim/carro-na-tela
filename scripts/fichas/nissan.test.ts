import { describe, expect, it } from "vitest";
import { nissanComparePage } from "./nissan.ts";

const source = { url: "https://www.nissan.com.br/veiculos/modelos/novo-kicks/compare.html", file: "nissan/novo-kicks.html", fetched: "2026-10-31" };
const spec = (unit: string, value: string, type = "Included") => ({ customKey: unit.replace(/\W/g, ""), value, unit, type });
const data = {
  grades: {
    "50091-ADVANCE": {
      versions: {
        "P13C-A": {
          name: "Advance 220T",
          techSpecs: [
            {
              value: "Motor",
              specs: [
                [spec("Combustível", "Etanol / Gasolina")],
                [spec("Transmissão", "DCT - Dupla Embreagem 6 Marchas")],
                [spec("Tipo", "1.0T, Flex")],
                [spec("Válvulas", "12")],
                [spec("Cilindrada, cm³", "999")],
                [spec("Torque Máx. kgfm @ rpm", "22,4 @ 2.500")],
                [spec("Torque Máx. Nm @ rpm", "220 @ 2.500")],
                [spec("Potência Max. cv @ rpm", "125 @ 5.000")],
                [spec("Tanque de Combustível", "48 L")],
              ],
            },
            { value: "Dimensões", specs: [[spec("Comprimento, mm", "4.365")], [spec("Altura livre do solo, mm", "200")]] },
            { value: "Ano de produção", specs: [[spec("Ano de produção", "2026/2027")]] },
            { value: "Volume", specs: [[spec("Porta-malas", "470 L")]] },
          ],
          equipmentSpecs: [
            { value: "Segurança", specs: [spec("", "Airbags duplos frontais"), spec("", "Teto solar", "Optional"), spec("", "Airbags duplos frontais")] },
            { value: "Aparência", specs: [] },
          ],
        },
      },
    },
  },
};
const html = `<script type="text/javascript">\n    HELIOS.components.c059D = ${JSON.stringify(data)};\n</script>`;

describe("Nissan's comparison pages", () => {
  it("reads each version's figures, years and items from the page's JSON", () => {
    const { sheets, lists } = nissanComparePage(html, "Kicks", source);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toMatchObject({
      brand: "nissan",
      line: "Kicks",
      title: "Kicks · Advance 220T",
      trims: ["advance"],
      years: [2026, 2027],
      engineLiters: 1,
      valves: 12,
      turbo: true,
      electric: false,
      diesel: false,
      transmission: "automatico",
      // The units are in the labels: "Potência Max. cv @ rpm".
      specs: { powerCv: 125, torqueKgfm: 22.4, lengthMm: 4365, groundClearanceMm: 200, trunkLiters: 470, tankLiters: 48 },
    });
    expect(lists.map((list) => list.groups)).toEqual([[{ name: "Segurança", items: ["Airbags duplos frontais", "Teto solar (opcional)"] }]]);
  });

  it("reads nothing from a page without the JSON", () => {
    expect(nissanComparePage("<html></html>", "Kicks", source)).toEqual({ sheets: [], lists: [] });
  });
});
