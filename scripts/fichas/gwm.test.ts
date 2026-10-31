import { describe, expect, it } from "vitest";
import { gwmPages, gwmSpecPage } from "./gwm.ts";

const source = { url: "https://www.gwmmotors.com.br/pt/modelos/x/specification", file: "gwm/x.html", fetched: "2026-10-31" };
const page = (slug: string) => gwmPages.find((item) => item.slug === slug)!;

describe("GWM's spec pages", () => {
  it("reads the Haval H9's: fields, then lines of items under headings", () => {
    const html = `
      <p class="text fs-text-body"> <b>Motor</b>: 2.4 Turbo Diesel<br /><b>Potência</b>: 184 cv<br /><b>Torque</b>: 480 Nm<br /><b>Capacidade do porta-malas</b>: 88-1598L<br /><b>Tanque de combustível</b>: 78 L </p>
      <p class="head fs-title-h2 fw-bold">Dimensões <i class="red-line"></i> </p>
      <p class="text fs-text-body"> <b>Comprimento</b>: 4.950 mm<br /><b>Largura</b>: 1.976 mm </p>
      <div class="right-content" id="conforto-container"> <div class="content-title fs-title-h1 fw-black">Conforto</div>
      <p class="text fs-text-body"> Bancos revestidos em couro ecológico<br />Teto solar panorâmico elétrico </p>
      <p class="head fs-title-h2 fw-bold">Iluminação <i class="red-line"></i> </p>
      <p class="text fs-text-body"> Faróis em Full-LED (Matrix)<br /> </p>`;
    const { sheet, list } = gwmSpecPage(html, page("haval-h9"), source);
    expect(sheet).toMatchObject({
      brand: "gwm",
      line: "Haval H9",
      title: "Haval H9 · Exclusive",
      trims: ["exclusive"],
      years: [2026, 2027],
      engineLiters: 2.4,
      diesel: true,
      onlyNamed: true,
      // 88 L with every seat up is too small to be a trunk figure here: none, not the folded 1,598.
      specs: { powerCv: 184, torqueKgfm: 48.9, lengthMm: 4950, widthMm: 1976, tankLiters: 78 },
    });
    expect(sheet?.specs.trunkLiters).toBeUndefined();
    expect(list?.groups).toEqual([
      { name: "Conforto", items: ["Bancos revestidos em couro ecológico", "Teto solar panorâmico elétrico"] },
      { name: "Iluminação", items: ["Faróis em Full-LED (Matrix)"] },
    ]);
  });

  it("reads the newer pages' popups, an item's name in bold before its description", () => {
    const html = `
      <p class="text fs-text-body"> <b>Motor&#8203;:</b> 100% elétrico<br /><b>Potência:</b> 204 cv<br /><b>Porta-malas:</b> 239 L /1.040 L </p>
      <div class="cmp__text-popup hidden " id="pop-conforto"><div class="title-bar"> <p class="fs-title-h2 fw-black">Conforto</p></div>
      <ul class="feature-list"><li><br /> </li><li class="disc"><b>Teto Panorâmico:</b> Amplitude e iluminação natural</li><li class="disc">Sensor de chuva</li></ul></div>`;
    const { sheet, list } = gwmSpecPage(html, page("ora5"), source);
    expect(sheet).toMatchObject({ title: "Ora · 05", trims: ["05"], electric: true, specs: { powerCv: 204, trunkLiters: 239 } });
    expect(sheet?.engineLiters).toBeUndefined();
    expect(list?.groups).toEqual([{ name: "Conforto", items: ["Teto Panorâmico", "Sensor de chuva"] }]);
  });
});
