import { describe, expect, it } from "vitest";
import { fordPages, fordSpecPage } from "./ford.ts";

const source = { url: "https://www.ford.com.br/picapes/ranger/compare-as-versoes/x.html", file: "ford/x.html", fetched: "2026-10-31" };
const page = (path: string) => fordPages.find((item) => item.path.endsWith(path))!;
const group = (name: string, rows: [string, string][]) =>
  `<li class="accordion-item"><div class="accordion-title  "><a href="#"><h3>${name}</h3></a></div><div class="accordion-body"><table>${rows
    .map(([title, data]) => `<tr>\n<td class="title">${title}</td>\n<td class="data">${data}</td>\n</tr>`)
    .join("")}</table></div></li>`;

describe("Ford's version pages", () => {
  it("reads the figures and the items, the year from the title", () => {
    const html = `<title>XLT 3.0 V6 Diesel 4WD AT 2027</title>
      ${group("EXTERIOR", [["Rodas de liga leve 18&quot;", ""], ["Pontos de amarração de carga", "6"]])}
      ${group("MOTOR E TRANSMISSÃO", [["Potência", "250 cv @ 3.250 rpm"], ["Torque", "600 Nm @ 1.750 rpm"], ["Motor", "3.0 V6 turbo Diesel"]])}
      ${group("DIMENSÕES", [["Largura do veículo com espelhos (mm)", "2208"], ["Comprimento do veículo (mm)", "5370"], ["Tanque de combistível (L)", "80"]])}
      ${group("ITENS DO KIT OPCIONAL", [["Santo Antônio", ""]])}`;
    const { sheet, list } = fordSpecPage(html, page("xlt-30-diesel-4wd-at"), source);
    expect(sheet).toMatchObject({
      brand: "ford",
      line: "Ranger",
      title: "Ranger · XLT 3.0 V6 Diesel 4WD AT",
      trims: ["xlt"],
      // 2027 in October 2026 is this year's 0 km too.
      years: [2026, 2027],
      engineLiters: 3,
      diesel: true,
      transmission: "automatico",
      onlyNamed: true,
      // Not the width with the mirrors.
      specs: { powerCv: 250, torqueKgfm: 61.2, lengthMm: 5370, tankLiters: 80 },
    });
    expect(sheet?.specs.widthMm).toBeUndefined();
    expect(list?.groups).toEqual([
      { name: "Exterior", items: ['Rodas de liga leve 18"', "Pontos de amarração de carga: 6"] },
      { name: "Itens do kit opcional", items: ["Santo Antônio (opcional)"] },
    ]);
  });

  it("takes the engine from a label with no value, and the fetch year when the title has none", () => {
    const html = `<title>Picape F-150 Lariat | Ford Brasil</title>
      ${group("PERFORMANCE", [["Motor Coyote 5.0L V8", ""], ["Potência", "405 cv @6000"]])}
      ${group("DIMENSÕES", [["Reservatório de combustível (L)", "136"]])}`;
    const { sheet, list } = fordSpecPage(html, page("f-150/compare-as-versoes/lariat"), source);
    expect(sheet).toMatchObject({ title: "F-150 · Lariat", years: [2026, 2027], engineLiters: 5, diesel: false, specs: { powerCv: 405, tankLiters: 136 } });
    // FIPE names no gearbox for the F-150.
    expect(sheet?.transmission).toBeUndefined();
    expect(list).toBeUndefined();
  });
});
