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
});
