import { describe, expect, it } from "vitest";
import { kiaNames, kiaSpecPage } from "./kia.ts";

// The Niro's pages, cut down: the model page names the codes; the spec page has
// an item table under a group heading, the hidden table and "Outras especificações".
const modelHtml = `
  <h3 class="versao-name">Niro HEV EX</h3><p class="versao-ano">Ano 2026, Modelo 2027</p>
  <p class="versao-preconame"><span class="codigoK">Código:</span>  <b>N.855</b></p>
  <h3 class="versao-name">Niro HEV SX PRESTIGE</h3>
  <p class="versao-preconame"><span class="codigoK">Código:</span>  <b>N.861</b></p>`;
const hidden = (rows: [string, string, string][]) =>
  `<table id="tblFT" style="display: none"><tr><th>Lista</th><th>Item</th><th>ValorItem</th><th>Subcategoria</th><th>NomeVersao</th><th>Ordem</th></tr>${rows
    .map(([item, value, version], index) => `<tr><td>${index}</td><td>${item}</td><td class="exibicaoFichaTecnicaVersao">${value}</td><td>MOTOR</td><td>${version}</td><td>1</td></tr>`)
    .join("")}</table>`;
const specHtml = `
  <li><span><a href="#" class="accordionTit">Conforto &amp; Conveni&#234;ncia</a></span><div class="accordionCont">
  <table><tr><th>Item</th><th data-versao="N.855">N.855</th><th data-versao="N.861">N.861</th></tr>
  <tr><td>Bancos dianteiros com ventilação</td><td class="exibicaoItemSerieVersao" data-versao="N.855">-</td><td class="exibicaoItemSerieVersao circle" data-versao="N.861">●</td></tr>
  <tr><td>Rodas de liga leve</td><td class="exibicaoItemSerieVersao circle" data-versao="N.855">●</td><td class="exibicaoItemSerieVersao circle" data-versao="N.861">aro 18”</td></tr>
  </table></div></li>
  ${hidden([
    ["MOTOR", "Kappa III - 1.6 L Smartstream GDI HEV", "N.855.2627"],
    ["Cilindrada (cm³)", "1580", "N.855.2627"],
    ["Potência máxima (Gas.) - (cv - rpm)", "105 - 5.700", "N.855.2627"],
    ["Potência máxima combinada (cv - rpm)", "141 - 5.700", "N.855.2627"],
    ["Torque máximo (kgm - rpm)", "27,0 - 1.000~2.400", "N.855.2627"],
    ["Comprimento (mm)", "4.420", "N.855.2627"],
    ["Aceleração (s) 0 - 100 km/h", "10,8", "N.855.2627"],
    ["Retomada de aceleração (s) 60 - 100 km/h", "5,4", "N.855.2627"],
    ["Transmissão Tipo", "Automática DCT", "N.855.2627"],
    ["MOTOR", "Kappa III - 1.6 L Smartstream GDI HEV", "N.861.2627"],
  ])}
  <table class="tg fichaT"><tr><th>Item</th><th class="exibicaoFichaTecnicaVersao" data-versao="N.855">N.855</th></tr>
  <tr><td>Volume do porta-malas - Rebatido (l)</td><td class="exibicaoFichaTecnicaVersao" data-versao="N.855">1.445 (VDA)</td></tr>
  <tr><td>Volume do porta-malas - Normal (l)</td><td class="exibicaoFichaTecnicaVersao" data-versao="N.855">425 (VDA)</td></tr>
  <tr><td>Volume do tanque de combustível (l)</td><td class="exibicaoFichaTecnicaVersao" data-versao="N.855">42</td></tr></table>`;
const source = { url: "https://www.kia.com.br/niro/especificacoes", file: "kia/niro.html", fetched: "2026-10-31" };

describe("Kia's spec pages", () => {
  it("names the version codes", () => {
    expect([...kiaNames(modelHtml)]).toEqual([
      ["N.855", "Niro HEV EX"],
      ["N.861", "Niro HEV SX PRESTIGE"],
    ]);
  });

  it("reads each version's figures and items", () => {
    const { sheets, lists } = kiaSpecPage(specHtml, kiaNames(modelHtml), source);
    const [ex] = sheets;
    expect(ex).toMatchObject({
      brand: "kia",
      line: "Niro",
      title: "Niro · HEV EX",
      trims: ["ex"],
      years: [2026, 2027],
      engineLiters: 1.6,
      electric: false,
      hybrid: true,
      // The combined power, the torque in kgm, the trunk with the seats up; not the pick-up time.
      specs: { powerCv: 141, torqueKgfm: 27, lengthMm: 4420, trunkLiters: 425, tankLiters: 42, zeroTo100s: 10.8 },
    });
    // FIPE names the hybrids without their gearbox: left open.
    expect(ex?.turbo).toBeUndefined();
    expect(ex?.transmission).toBeUndefined();
    expect(lists.map((list) => [list.title, list.groups])).toEqual([
      ["Niro · HEV EX", [{ name: "Conforto & Conveniência", items: ["Rodas de liga leve"] }]],
      ["Niro · HEV SX PRESTIGE", [{ name: "Conforto & Conveniência", items: ["Bancos dianteiros com ventilação", "Rodas de liga leve: aro 18”"] }]],
    ]);
  });

  it("makes a version that names no trim the line's plain one, and a page still on sale this year's", () => {
    const stonic = `<h3 class="versao-name">Stonic MHEV C.253</h3><p class="versao-preconame">Código: <b>C.253</b></p>`;
    const page = hidden([["MOTOR", "Kappa - 1.0 L Smartstream Turbo GDI MHEV", "C.253.2425"], ["Comprimento (mm)", "4140", "C.253.2425"]]);
    const [sheet] = kiaSpecPage(page, kiaNames(stonic), source).sheets;
    expect(sheet).toMatchObject({ title: "Stonic · MHEV", trims: [], base: true, years: [2024, 2026], turbo: true });
  });
});
