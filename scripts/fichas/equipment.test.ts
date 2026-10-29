import { describe, expect, it } from "vitest";
import { equipmentOfVersion, renaultEquipment } from "./equipment.ts";

// Rows of Renault's Logan list (an old .xls: every row starts empty).
const loganRows = [
  ["", "LISTA DE EQUIPAMENTOS", "Logan"],
  ["", "Versões", "Life", "Zen", "", "Intense"],
  ["", "", "1.0 12V", "1.0 12V / 1.6 16V", "1.6 CVT", "1.6 CVT"],
  ["", "CONFORTO E CONVENIÊNCIA"],
  ["", "Ar-condicionado", "l", "l", "l", "-"],
  ["", "Ar-condicionado automático", "-", "-", "-", "l"],
  ["", "Câmera de ré", "-", "-", "-", "l"],
  ["", "SEGURANÇA"],
  ["", "Freios ABS", "l", "l", "l", "l"],
  ["", "Airbags laterais", "-", "o", "l", "l"],
  ["", "* Sistema disponível somente para motor 1.6"],
];
const link = { vehicle: "Logan", file: "5-logan.xlsx", page: "https://imprensa/logan" };
const lists = renaultEquipment(loganRows, link, new Date("2019-07-04"));
const target = { brand: "Renault", family: "LOGAN", modelYear: 2021, turbo: false, electric: false };

describe("equipment lists", () => {
  it("reads a column per version, the trim repeating over its engines", () => {
    expect(lists.map((list) => [list.title, list.trims, list.engineLiters, list.transmission, list.years])).toEqual([
      ["Logan · Life 1.0 12V", ["life"], 1, undefined, [2019, 2022]],
      ["Logan · Zen 1.0 12V / 1.6 16V", ["zen"], undefined, undefined, [2019, 2022]],
      ["Logan · Zen 1.6 CVT", ["zen"], 1.6, "automatico", [2019, 2022]],
      ["Logan · Intense 1.6 CVT", ["intense"], 1.6, "automatico", [2019, 2022]],
    ]);
    expect(lists[1]!.groups).toEqual([
      { name: "Conforto e conveniência", items: ["Ar-condicionado"] },
      { name: "Segurança", items: ["Freios ABS", "Airbags laterais (opcional)"] },
    ]);
  });

  it("gives a version its trim's list, by engine and gearbox, and none to another trim", () => {
    const of = (name: string, engineLiters: number, fields = {}) =>
      equipmentOfVersion(lists, { ...target, name, engineLiters, ...fields })?.title;
    expect(of("LOGAN Zen Flex 1.6 16V 4p Aut.", 1.6)).toBe("Logan · Zen 1.6 CVT");
    expect(of("LOGAN Zen Flex 1.0 12V 4p Mec.", 1)).toBe("Logan · Zen 1.0 12V / 1.6 16V");
    expect(of("LOGAN Intense Flex 1.6 16V 4p Aut.", 1.6)).toBe("Logan · Intense 1.6 CVT");
    expect(of("LOGAN Expression Flex 1.6 16V 4p", 1.6)).toBeUndefined();
    expect(of("LOGAN Zen Flex 1.6 16V 4p Aut.", 1.6, { modelYear: 2024 })).toBeUndefined();
  });
});
