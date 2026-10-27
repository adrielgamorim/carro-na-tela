import { describe, expect, it } from "vitest";
import { formatFleetCount } from "../../src/catalog/fleet.ts";
import { createFleetCounter, fleetFileMonth } from "./frota.ts";
import { matchFleet } from "./match.ts";

describe("fleetFileMonth", () => {
  it("reads the month from the file name", () => {
    expect(fleetFileMonth("i_frota_por_uf_municipio_marca_e_modelo_ano_setembro_2026.zip")).toEqual({
      key: "2026-09",
      label: "setembro de 2026",
    });
    expect(fleetFileMonth("I_Frota_Marca_e_Modelo_Ano_Marco_2025.zip")).toEqual({
      key: "2025-03",
      label: "março de 2025",
    });
    expect(fleetFileMonth("frota_munic_modelo_dezembro_2023.xls")).toBeNull();
  });
});

describe("createFleetCounter", () => {
  it("adds up states and cities across chunk boundaries", () => {
    const counter = createFleetCounter();
    const text = [
      "UF;Município;Marca Modelo;Ano Fabricação Veículo CRV;Qtd. Veículos",
      "ACRE;ACRELANDIA;CHEV/ONIX 10MT LT;2020; 2.0",
      "SAO PAULO;SAO PAULO;CHEV/ONIX  10MT LT;2020; 1500.0",
      "SAO PAULO;SAO PAULO;CHEV/ONIX 10MT LT;2021; 3.0",
      "SAO PAULO;SAO PAULO;VW/GOL 1.0;Sem Informação; 9.0",
      "",
    ].join("\r\n");
    counter.push(text.slice(0, 90));
    counter.push(text.slice(90));
    expect(counter.finish()).toEqual({ "CHEV/ONIX 10MT LT": { "2020": 1502, "2021": 3 } });
    expect(counter.lines).toBe(3);
    expect(counter.states()).toEqual({ "CHEV/ONIX 10MT LT": { AC: 2, SP: 1503 } });
  });
});

describe("matchFleet", () => {
  const models = {
    "CHEV/ONIX 10MT LT": { "2020": 100 },
    "GM/ONIX PLUS 10TAT": { "2021": 50 },
    "VW/GOL 1.0": { "2015": 300 },
    "VW/NOVO GOL 1.0": { "2016": 10 },
    "VW/GOLF GTI": { "2018": 7 },
    "VW/UPGRADE X": { "2018": 1000 },
    "VW/UP TSI": { "2018": 20 },
    "I/TOYOTA HILUX CD4X4 SRV": { "2019": 40 },
    "TOYOTA/HILUXSW4 SRV4X4": { "2019": 5 },
    "CAOACHERY/TIGGO7 PRO": { "2023": 8 },
    "HONDA/CG 160 FAN": { "2022": 5000 },
    "SCANIA/R 450": { "2020": 3 },
  };
  const states = {
    "CHEV/ONIX 10MT LT": { SP: 90, RJ: 10 },
    "GM/ONIX PLUS 10TAT": { SP: 50 },
    "VW/GOL 1.0": { SP: 100, RJ: 200 },
  };
  const match = matchFleet(models, [
    { brand: "GM - Chevrolet", family: "ONIX" },
    { brand: "VW - VolksWagen", family: "Gol" },
    { brand: "VW - VolksWagen", family: "Golf" },
    { brand: "VW - VolksWagen", family: "up!" },
    { brand: "Toyota", family: "Hilux" },
    { brand: "Caoa Chery", family: "Tiggo 7" },
    { brand: "Caoa Chery/Chery", family: "TIGGO 7" },
    { brand: "Honda", family: "Civic" },
  ], states);

  it("counts each line, ranked, through brand codes and imports", () => {
    expect(match.lines.map(({ family, total, rank }) => [family, total, rank])).toEqual([
      ["Gol", 310, 1],
      ["ONIX", 150, 2],
      ["Hilux", 45, 3],
      ["up!", 20, 4],
      ["Tiggo 7", 8, 5],
      ["Golf", 7, 6],
    ]);
    expect(match.lines[1]?.years).toEqual({ "2020": 100, "2021": 50 });
    // Per state: Onix leads in SP, Gol in RJ.
    expect(match.lines[0]?.states).toEqual({ RJ: [200, 1], SP: [100, 2] });
    expect(match.lines[1]?.states).toEqual({ RJ: [10, 2], SP: [140, 1] });
    expect(match.lines[2]?.states).toBeUndefined();
  });

  it("gives brands that share a line the same one", () => {
    const tiggo = match.lineOf.get("Caoa Chery\nTiggo 7");
    expect(tiggo).toBe(4);
    expect(match.lineOf.get("Caoa Chery/Chery\nTIGGO 7")).toBe(tiggo);
    expect(match.lineOf.has("Honda\nCivic")).toBe(false);
  });

  it("reports what the catalog's brands left unmatched", () => {
    expect(match.unmatched.map(([name]) => name)).toEqual(["HONDA/CG 160 FAN", "VW/UPGRADE X"]);
    expect(match.matched).toBe(540);
    expect(match.brandTotal).toBe(6540);
  });
});

describe("formatFleetCount", () => {
  it("abbreviates millions and thousands", () => {
    expect(formatFleetCount(6_462_492)).toBe("6,5 mi");
    expect(formatFleetCount(845_300)).toBe("845 mil");
    expect(formatFleetCount(9_870)).toBe("9.870");
  });
});
