import { describe, expect, it } from "vitest";
import { generationOf, imageFile, parseGenerations, productionYears } from "./generations.ts";

// Trimmed from the real pt:Volkswagen Gol and pt:Renault Sandero.
const ptGol = `{{Info/Automóvel
|nome = Volkswagen Gol
|imagem = Volkswagen Gol Highline 2023 (53708009248) (cropped).jpg
|produção = 1980–2023
}}
== Gol G4 ==
{{Info/Automóvel
|nome = Gol G4
|imagem = [[Imagem:Volkswagen Gol Trendline Plus IV Gen.jpg|250px]]
|produção = 2005–2014
}}
== Gol G5 ==
{{Info/Automóvel
|nome = Gol G5
|imagem = [[Imagem:Volkswagen_Gol_1.6_Trend_2011_(13905746021).jpg|250px]]
|produção = 2008–2012<ref>{{citar web|url=https://x|título=2010}}</ref>
}}
== Novo Gol ==
{{Info/Automóvel
|nome = Novo Gol (Gol G6)
|imagem = [[Imagem:Volkswagen Gol 1.6 Power 2013 (12489173025).jpg|250px]]
|produção = 2012–2022
}}`;

describe("generations", () => {
  it("reads the file name in its many shapes", () => {
    expect(imageFile("[[Imagem:Volkswagen_Gol_G5.jpg|250px]]")).toBe("Volkswagen Gol G5.jpg");
    expect(imageFile(" Red hyundai hb20.JPG")).toBe("Red hyundai hb20.JPG");
    expect(imageFile("{{Imagem múltipla|direction=vertical|image1=Fiat Uno 1984.jpg|image2=Uno 2010.jpg}}")).toBe(
      "Fiat Uno 1984.jpg",
    );
    expect(imageFile("Mercedes-Benz Sprinter timeline.jpg")).toBeNull();
    expect(imageFile("")).toBeNull();
  });

  it("reads production years, Brazil's when given per country", () => {
    expect(productionYears("2008–2012")).toEqual([2008, 2012]);
    expect(productionYears("[[2012]]-presente")).toEqual([2012, null]);
    expect(productionYears("{{ROMb}} 2007 — 2012 <br/> {{BRAb}} 2007 — 2014 <br/> {{COLb}} 2009")).toEqual([
      2007, 2014,
    ]);
    expect(productionYears("2008–2012<ref>dated 2019</ref>")).toEqual([2008, 2012]);
    expect(productionYears("")).toBeNull();
  });

  it("lists the generations of an article, and none for a single infobox", () => {
    const generations = parseGenerations(ptGol);
    expect(generations.map(({ file, from, to }) => `${from}-${to} ${file}`)).toEqual([
      "1980-2023 Volkswagen Gol Highline 2023 (53708009248) (cropped).jpg",
      "2005-2014 Volkswagen Gol Trendline Plus IV Gen.jpg",
      "2008-2012 Volkswagen Gol 1.6 Trend 2011 (13905746021).jpg",
      "2012-2022 Volkswagen Gol 1.6 Power 2013 (12489173025).jpg",
    ]);
    expect(parseGenerations("{{Infobox automobile\n| image = Fiat Strada.jpg\n| production = 1998–present\n}}")).toEqual(
      [],
    );
  });

  it("picks the narrowest generation that covers the model year", () => {
    const generations = parseGenerations(ptGol);
    expect(generationOf(generations, 2010)?.file).toContain("Trend 2011");
    expect(generationOf(generations, 2016)?.file).toContain("Power 2013");
    expect(generationOf(generations, 2006)?.file).toContain("IV Gen");
    // The line was made until 2023: its own infobox covers that year exactly.
    expect(generationOf(generations, 2023)?.file).toContain("Highline 2023");
    // Without it, model year 2023 of a car made until 2022 still counts as the G6.
    expect(generationOf(generations.slice(1), 2023)?.file).toContain("Power 2013");
    expect(generationOf(generations, 2025)).toBeUndefined();
    expect(generationOf(generations, 1970)).toBeUndefined();
    // A generation still made spans until this year, not until the year asked for.
    const stillMade = [...generations, { file: "VW Gol 2009 front.jpg", from: 2008, to: null }];
    expect(generationOf(stillMade, 2009, 2026)?.file).toContain("Trend 2011");
  });

  it("keeps the names of each generation", () => {
    const names = parseGenerations(
      `${ptGol}\n{{Infobox automobile\n| name = First generation (Type 146)\n| aka = Fiat Mille (Brazil)<br />Innocenti Mille<ref>x</ref>\n| image = Uno.jpg\n| production = 1983–2013\n}}`,
    ).map((generation) => generation.names);
    expect(names.at(-2)).toBe("novo gol gol g6");
    expect(names.at(-1)).toBe("first generation type 146 fiat mille brazil innocenti mille");
  });

  it("tells overlapping generations apart by the version's name", () => {
    const uno = [
      { file: "Uno 2011.jpg", from: 1983, to: 2021, names: "fiat uno fiat mille innocenti mille clip" },
      { file: "Uno 2007.jpg", from: 1983, to: 2014, names: "first generation type 146 fiat mille brazil" },
      { file: "Uno 2011.jpg", from: 2010, to: 2021, names: "second generation type 327" },
    ];
    expect(generationOf(uno, 2012, 2026, "Mille WAY ECONOMY 1.0 F.Flex 2p")?.file).toBe("Uno 2007.jpg");
    expect(generationOf(uno, 2012, 2026, "WAY 1.0 EVO Fire Flex 8V 2p")?.from).toBe(2010);
    // Only the first word counts, and not a body style every generation had.
    expect(generationOf(uno, 2012, 2026, "WAY Mille 1.0")?.from).toBe(2010);
    const onix = [
      { file: "Onix 2012.jpg", from: 2012, to: 2019, names: "first generation chevrolet prisma sedan" },
      { file: "Onix 2020.jpg", from: 2019, to: null, names: "second generation" },
    ];
    expect(generationOf(onix, 2021, 2026, "SEDAN Plus LT 1.0 12V")?.file).toBe("Onix 2020.jpg");
    // "(novo)" is the newest generation of that year.
    const generations = parseGenerations(ptGol);
    expect(generationOf(generations, 2013, 2026, "(novo) 1.0 Mi Total Flex 8V 2p")?.file).toContain("Power 2013");
    expect(generationOf(generations, 2010, 2026, "(novo) 1.0 Mi Total Flex 8V 4p")?.file).toContain("Trend 2011");
    expect(generationOf(generations, 2013, 2026, "City (Trend) 1.0 Mi")?.file).toContain("IV Gen");
  });
});
