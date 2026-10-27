import { describe, expect, it } from "vitest";
import { createWikidataMatcher, parseSparqlModels } from "./match.ts";
import type { WikidataModel } from "./match.ts";

function model(id: string, names: string[], extra: Partial<WikidataModel> = {}): WikidataModel {
  return { id, label: names[0], names, labelCount: 1, brands: [], image: `${id}.jpg`, ...extra };
}

describe("createWikidataMatcher", () => {
  const models = [
    model("onix", ["Chevrolet Onix"], { brands: ["Chevrolet"] }),
    model("onixplus", ["Chevrolet Onix Plus"], { brands: ["Chevrolet"] }),
    // The Suzuki Ignis was sold as "Chevrolet Cruze" in Japan (an alias).
    model("ignis", ["Suzuki Ignis", "Chevrolet Cruze"], { brands: ["Suzuki"] }),
    model("cruze", ["Chevrolet Cruze"], { brands: ["General Motors", "Chevrolet"] }),
    model("hb20", ["Hyundai HB20"], { brands: ["Hyundai"] }),
    model("cclass", ["Mercedes-Benz C-Class", "Mercedes-Benz Classe C"], { brands: ["Mercedes-Benz"] }),
    model("evoque", ["Range Rover Evoque"], { brands: ["Land Rover"] }),
    model("polo", ["Volkswagen Polo"], { brands: ["Volkswagen"] }),
    model("polo4", ["Volkswagen Polo Mk4", "Volkswagen Polo"], { brands: ["Volkswagen"], from: 2002, to: 2009 }),
    model("polo6", ["Volkswagen Polo Mk6", "Volkswagen Polo"], { brands: ["Volkswagen"], from: 2017 }),
    model("logan", ["Dacia Logan", "Renault Logan"], { brands: ["Dacia"] }),
  ];
  const match = createWikidataMatcher(models);
  const id = (brand: string, name: string, years = [2024]) =>
    match({ brand, model: name, years })?.id ?? null;

  it("matches the longest model name after the brand", () => {
    expect(id("GM - Chevrolet", "ONIX PLUS LTZ 1.0 12V TB Flex Aut.")).toBe("onixplus");
    expect(id("GM - Chevrolet", "ONIX HATCH LT 1.0 12V Flex 5p Mec.")).toBe("onix");
  });

  it("prefers the right brand and labels over aliases", () => {
    expect(id("GM - Chevrolet", "CRUZE LTZ 1.4 16V Turbo Flex Aut.")).toBe("cruze");
    expect(id("Renault", "LOGAN Zen Flex 1.0 12V Mec.")).toBe("logan");
  });

  it("prefers the generation of the version's years", () => {
    expect(id("VW - VolksWagen", "Polo Track 1.0 Flex 12V 5p", [2024, 2025])).toBe("polo6");
    expect(id("VW - VolksWagen", "Polo 1.6 Mi 8V 4p", [2005])).toBe("polo4");
  });

  it("handles model series, glued letters and names that include the line", () => {
    expect(id("Mercedes-Benz", "C-200 Avantgarde 2.0 TB 16V Aut.")).toBe("cclass");
    expect(id("Mercedes-Benz", "CLASSE C 180 1.6 Aut.")).toBe("cclass");
    expect(id("Hyundai", "HB20S Comfort Plus 1.0 TB Flex 12V Aut.")).toBe("hb20");
    expect(id("Land Rover", "Range Rover Evoque Dynamic 2.0 Aut. 5p")).toBe("evoque");
  });

  it("does not match other brands or unknown models", () => {
    expect(id("Fiat", "ONIX 1.0")).toBeNull();
    expect(id("Hyundai", "HB2 1.0")).toBeNull();
    expect(id("GM - Chevrolet", "Spin LTZ 1.8")).toBeNull();
    // "320iA" is the 3 Series, not the 1930s "BMW 3/20".
    expect(createWikidataMatcher([model("320", ["BMW 3/20"], { brands: ["BMW"] })])({
      brand: "BMW",
      model: "320iA 2.0 TB M Sport Aut.",
      years: [2024],
    })).toBeNull();
  });

  it("applies manual overrides before the name match", () => {
    const withOverrides = createWikidataMatcher(models, [
      { brand: "gm - chevrolet", modelPrefix: "onix plus", id: "onix" },
      { brand: "Hyundai", model: "HB20S Comfort 1.0", none: true },
      { brand: "Hyundai", modelPrefix: "HB20X", id: "Q404" },
    ]);
    const find = (brand: string, name: string) =>
      withOverrides({ brand, model: name, years: [2024] })?.id ?? null;
    expect(find("GM - Chevrolet", "ONIX PLUS LT 1.0")).toBe("onix");
    expect(find("Hyundai", "HB20S  Comfort 1.0")).toBeNull();
    expect(find("Hyundai", "HB20X Vision 1.6")).toBeNull();
    expect(find("Hyundai", "HB20S Platinum 1.0")).toBe("hb20");
  });
});

describe("parseSparqlModels", () => {
  it("reads labels, aliases, brands, image and article", () => {
    const value = (text: string) => ({ value: text });
    expect(
      parseSparqlModels([
        {
          m: value("http://www.wikidata.org/entity/Q30013813"),
          en: value("Fiat Argo"),
          pt: value("Fiat Argo"),
          aliases: value("Argo"),
          brands: value("Fiat|Fiat Automobiles"),
          image: value("http://commons.wikimedia.org/wiki/Special:FilePath/Fiat%20Argo%202018.jpg"),
          ptwiki: value("https://pt.wikipedia.org/wiki/Fiat_Argo"),
          from: value("2017"),
        },
        { m: value("http://www.wikidata.org/entity/Q1"), aliases: value("") },
      ]),
    ).toEqual([
      {
        id: "Q30013813",
        label: "Fiat Argo",
        names: ["Fiat Argo", "Argo"],
        labelCount: 1,
        brands: ["Fiat", "Fiat Automobiles"],
        image: "Fiat Argo 2018.jpg",
        ptwiki: "Fiat_Argo",
        from: 2017,
      },
    ]);
  });
});
