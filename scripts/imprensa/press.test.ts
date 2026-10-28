import { describe, expect, it } from "vitest";
import { decodeEntities, engineIn, releaseText, sentences, torqueKgfm, trunkLiters } from "./press.ts";

describe("press releases", () => {
  it("reads the release body as lines of plain text", () => {
    const html = `<nav><p>Menu</p></nav><div class="fca-Container_Description fca-Description_News">
      <p style="x">O porta-malas disp&otilde;e de 370 litros.</p><p>DRIVE &ndash; R$&nbsp;79.990</p>
      </div><div id="DamAssets-shortcut-container">Outros</div>`;
    expect(releaseText(html)).toBe("O porta-malas dispõe de 370 litros.\nDRIVE – R$ 79.990");
    expect(decodeEntities("Citro&euml;n &#8211; 2&ordf;")).toBe("Citroën – 2ª");
    expect(sentences("Tem 130 cv. O torque é de 20,4 kgfm.\nLista")).toEqual([
      "Tem 130 cv.",
      "O torque é de 20,4 kgfm.",
      "Lista",
    ]);
  });

  it("reads the trunk volume with the seats up", () => {
    expect(trunkLiters("O porta-malas dispõe de 370 litros de capacidade")).toBe(370);
    expect(
      trunkLiters("um dos maiores porta-malas da categoria com 1.760 litros com todos os bancos rebaixados, 661 litros na configuração com cinco lugares"),
    ).toBe(661);
    expect(trunkLiters("O amplo espaço continua no porta-malas de até 465 litros (435 l na versão Ultra-Híbrida)")).toBe(465);
    expect(trunkLiters("ampliar o espaço para carga até 1.175 litros (sem rebatimento, o porta-malas é de 400 litros")).toBe(400);
    expect(trunkLiters("O motor 1.3 consome 10 litros")).toBeNull();
  });

  it("reads the highest torque, Nm converted to kgfm", () => {
    expect(torqueKgfm("torque máximo de 18,4 kgfm com gasolina e 18,9 kgfm com etanol")).toBe(18.9);
    expect(torqueKgfm("O amplo torque de 200 Nm (20,4 kgf.m), independente do combustível")).toBe(20.4);
    expect(torqueKgfm("entrega 200 cv de potência e 450 Nm de torque")).toBe(45.9);
    expect(torqueKgfm("436 cv de potência e 1.458 Nm (148,7 kgfm) de torque")).toBe(148.7);
    expect(torqueKgfm("1.3 turbo com 185 cv e 27,50 kgfm de torque")).toBe(27.5);
    expect(torqueKgfm("motor de 130 cv")).toBeNull();
  });

  it("tells which engine a sentence is about", () => {
    expect(engineIn("o motor Turbo 200 Flex, que traz 130 cv")).toEqual({ liters: 1, turbo: true, diesel: false });
    expect(engineIn("o motor Firefly quatro cilindros 1.3 de 109 cv e 14,2 kgfm")).toEqual({
      liters: 1.3,
      turbo: false,
      diesel: false,
    });
    expect(engineIn("Com o motor MultiJet 2.2 Turbodiesel, entrega 200 cv")).toEqual({
      liters: 2.2,
      turbo: true,
      diesel: true,
    });
    expect(engineIn("acelera de 0 a 100 km/h em 5,3 segundos graças ao novo motor 3.0 Hurricane 6 biturbo")).toEqual({
      liters: 3,
      turbo: true,
      diesel: false,
    });
    expect(engineIn("é equipada com o motor Hurricane 2.0, que entrega 272 cv")?.turbo).toBe(true);
    expect(engineIn("motor E.TorQ 1.8 de 130 cv")?.valves).toBe(16);
    expect(engineIn("motorização 1.8 litro, 8 válvulas, que oferece 112 cv")?.valves).toBe(8);
    // Two engines in one sentence: the torque can't be told apart.
    expect(engineIn("os motores 1.3 e 1.8 entregam até 18,9 kgfm")).toBeUndefined();
    expect(engineIn("torque de 20 kgfm")).toBeUndefined();
  });
});
