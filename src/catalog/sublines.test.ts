import { describe, expect, it } from "vitest";
import { versionLines } from "./sublines";

const lines = (brand: string, names: string[]) =>
  versionLines(names.map((name) => [brand, name])).map(({ family, subline }) => `${family} | ${subline ?? "-"}`);

describe("versionLines", () => {
  it("spells a line once per brand and reads the sub-line after it", () => {
    expect(
      lines("Fiat", [
        "UNO WAY 1.0 Fire Flex 8V 5p",
        "Uno Way Celebration 1.0 Flex 5p",
        "Uno Mille 1.0 Fire/F.Flex/ECONOMY 2p",
        "UNO ATTRACTIVE 1.0 Fire Flex 8V 5p",
        "UNO ATTRACTI. Celeb.1.4 EVO F.Flex 8V 2p",
        "UNO SPORTING 1.4 EVO Flex 8V 5p",
        "UNO SPORT.INTERLAGOS 1.4 Flex 5p",
      ]),
    ).toEqual([
      "Uno | Uno Way",
      "Uno | Uno Way",
      "Uno | Uno Mille",
      "Uno | Uno Attractive",
      "Uno | Uno Attractive",
      "Uno | Uno Sporting",
      "Uno | Uno Sporting",
    ]);
  });

  it("joins abbreviations to the line's most common full word", () => {
    expect(
      lines("Fiat", ["Strada Adv.1.8 16V Flex CD", "Strada Adventure 1.8 Flex CE", "Strada Working 1.4 Flex CS"]),
    ).toEqual(["Strada | Strada Adventure", "Strada | Strada Adventure", "Strada | Strada Working"]);
    expect(lines("GM - Chevrolet", ["ONIX SEDAN Plus LT 1.0", "ONIX SD. P. PREM. 1.0", "ONIX HATCH LTZ 1.4"])).toEqual([
      "ONIX | ONIX Sedan",
      "ONIX | ONIX Sedan",
      "ONIX | ONIX Hatch",
    ]);
  });

  it("reads abbreviations without a dot, and known ones the line never spells out", () => {
    expect(
      lines("Fiat", ["Strada Adv/Adv TRYON 1.8 CD", "Strada Adventure 1.8 Flex CE", "Strada Celeb. 1.4 Fire Flex CS"]),
    ).toEqual(["Strada | Strada Adventure", "Strada | Strada Adventure", "Strada | Strada Celebration"]);
    expect(lines("GM - Chevrolet", ["S10 P-Up Colina 2.8 4x4", "S10 Pick-Up LT 2.8"])).toEqual([
      "S10 | S10 Pick-Up",
      "S10 | S10 Pick-Up",
    ]);
    expect(lines("Toyota", ["Corolla SE-G 1.8 16V Aut."])).toEqual(["Corolla | Corolla SE-G"]);
  });

  it("leaves out engines, single letters and short codes as they are", () => {
    expect(
      lines("VW - VolksWagen", ["Gol 1.6 Mi Total Flex 8V 4p", "Gol (novo) 1.0 Flex", "Gol I MOTION 1.6", "Gol Trendline 1.0"]),
    ).toEqual(["Gol | -", "Gol | -", "Gol | -", "Gol | Gol Trendline"]);
    expect(lines("Fiat", ["ARGO HGT 1.8 16V Flex Aut.", "ARGO DRIVE 1.0 6V Flex"])).toEqual([
      "ARGO | ARGO HGT",
      "ARGO | ARGO Drive",
    ]);
    expect(lines("VW - VolksWagen", ["Polo TSI 1.0 Flex"])).toEqual(["Polo | -"]);
  });

  it("keeps two-word lines whole", () => {
    expect(lines("Land Rover", ["Range Rover Evoque 2.0"])).toEqual(["Range Rover | Range Rover Evoque"]);
  });
});
