import { describe, expect, it } from "vitest";
import { baseOf, proseItems, versionBlocks } from "./release-equipment.ts";
import { releaseEquipment, releaseGroup } from "./release-lists.ts";

describe("equipment in press releases", () => {
  it("reads a list per version under its price, and the version it adds to", () => {
    const text = [
      "Com essas opções, o Kwid 2027 amplia as possibilidades.",
      "Versão Evolution – R$ 71.190",
      "Principais itens de série:",
      "4 airbags (2 frontais e 2 laterais)",
      "Ar-condicionado",
      "NOVO - Sensor de estacionamento traseiro",
      "iTPMS - Monitoramento de pressão de pneus • Limpador traseiro",
      "Cores disponíveis: Branco Glacier e Preto Nacré",
      "Versão Outsider – R$ 84.890",
      "Principais itens de série: todos da versão Evolution mais",
      "Barras de teto",
      "Rodas de liga leve 14''",
      "Sensor crepuscular",
      "Opcionais: Pack AFS: protetor de cárter + câmera de ré – R$ 1.839",
      "Sobre a marca Renault no Brasil",
      "A Renault oferece uma gama completa.",
    ].join("\n");
    const blocks = versionBlocks(text);
    expect(blocks.map(({ version, base, items, optional, prose }) => ({ version, base, items, optional, prose }))).toEqual([
      {
        version: "Evolution",
        base: undefined,
        items: ["4 airbags (2 frontais e 2 laterais)", "Ar-condicionado", "Sensor de estacionamento traseiro", "iTPMS - Monitoramento de pressão de pneus", "Limpador traseiro"],
        optional: [],
        prose: false,
      },
      {
        version: "Outsider",
        base: "Evolution",
        items: ["Barras de teto", "Rodas de liga leve 14''", "Sensor crepuscular"],
        optional: ["Pack AFS: protetor de cárter", "câmera de ré"],
        prose: false,
      },
    ]);
  });

  it("leaves out the prices of options and the boilerplate after the versions", () => {
    const blocks = versionBlocks(["Pack Design – R$ 1.500", "Fiat Argo Drive 1.0 – R$ 58.890,00", "Ar", "Inscreva-se na newsletter.", "RSS"].join("\n"));
    expect(blocks.map((block) => [block.version, block.items])).toEqual([["Fiat Argo Drive 1.0", ["Ar"]]]);
  });

  it("finds the base however the release names it", () => {
    expect(baseOf("Todos os itens da versão Live Go mais:")).toBe("Live Go");
    expect(baseOf("Todos os itens do Overland MHEV 48V (exceto o motor) mais:")).toBe("Overland MHEV 48V");
    expect(baseOf("Acrescenta em relação à Drive 1.3 Flex Manual")).toBe("Drive 1.3 Flex Manual");
    expect(baseOf("Todos os equipamentos da versão evolution mais")).toBe("evolution");
    expect(baseOf("Todos os itens acima mais")).toBe("acima");
    expect(baseOf("Ar-condicionado digital")).toBeUndefined();
  });

  it("drafts the items of prose", () => {
    expect(proseItems("A versão traz itens como direção elétrica, ar-condicionado, vidros elétricos dianteiros e volante com regulagem de altura.")).toEqual([
      "Direção elétrica",
      "Ar-condicionado",
      "Vidros elétricos dianteiros",
      "Volante com regulagem de altura",
    ]);
  });

  it("gives a version its base's items, the base's options it has as standard left out", () => {
    const common = { brand: "renault" as const, line: "Kwid", years: [2027, 2027] as [number, number], page: "https://x" };
    const [evolution, outsider] = releaseEquipment({
      lists: [
        { ...common, key: "x#evolution", title: "Kwid · Evolution", trims: ["evolution"], items: ["Ar"], optional: ["Câmera de ré"] },
        { ...common, key: "x#outsider", title: "Kwid · Outsider", trims: ["outsider"], addsTo: "x#evolution", items: ["Câmera de ré", "Barras de teto"], optional: [] },
      ],
      rejected: [],
    });
    expect(evolution!.groups).toEqual([{ name: releaseGroup, items: ["Ar", "Câmera de ré (opcional)"] }]);
    expect(outsider!.groups).toEqual([{ name: releaseGroup, items: ["Ar", "Câmera de ré", "Barras de teto"] }]);
    expect(outsider).toMatchObject({ fallback: true, electric: false, file: "https://x" });
  });
});
