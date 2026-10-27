import { describe, expect, it } from "vitest";
import { cleanWikiText, createBrandMatcher, parseCountryRanges, parseWmiRows } from "./wmi.ts";

const wikitext = `
====Country or region codes====
'''AA-AH''' South Africa<br />
'''BC'''    Ethiopia<br/>
'''9A-9E''' [[Brazil]]<br />
===Vehicle descriptor section===
==List of common WMI==
===South America===
|-
| 9BD ||rowspan=3| Brazil || [[Fiat Automóveis]]
|-
| 9BG || [[General Motors do Brasil]] Chevrolet<ref name="KBA list" />
|-
| 9C2 || [[Honda Motorcycles]]<ref>{{cite web |url=x}}</ref>
|-
| DA1 DA4 || Arab American Vehicles
|-
| 9FB ||row span =“2” | Colombia || [[Sofasa]] ([[Renault]])
|-
| 9GA || [[GM Colmotores]] S.A. ([[Chevrolet]])
|}
==See also==
`;

describe("WMI list", () => {
  it("cleans wiki markup", () => {
    expect(cleanWikiText("[[Suzuki|Suzuki (motorcycles)]] by '''X'''<ref name=\"a\" /> {{cn}}")).toBe(
      "Suzuki (motorcycles) by X",
    );
  });

  it("reads rows, carrying the country across row spans", () => {
    expect(parseWmiRows(wikitext)).toEqual([
      { codes: ["9BD"], country: "Brazil", maker: "Fiat Automóveis" },
      { codes: ["9BG"], country: "Brazil", maker: "General Motors do Brasil Chevrolet" },
      { codes: ["9C2"], country: "Brazil", maker: "Honda Motorcycles" },
      { codes: ["DA1", "DA4"], country: null, maker: "Arab American Vehicles" },
      { codes: ["9FB"], country: "Colombia", maker: "Sofasa (Renault)" },
      { codes: ["9GA"], country: "Colombia", maker: "GM Colmotores S.A. (Chevrolet)" },
    ]);
  });

  it("reads the country ranges", () => {
    expect(parseCountryRanges(wikitext)).toEqual([
      ["AA", "AH", "South Africa"],
      ["BC", "BC", "Ethiopia"],
      ["9A", "9E", "Brazil"],
    ]);
  });
});

describe("createBrandMatcher", () => {
  const match = createBrandMatcher([
    "Fiat",
    "GM - Chevrolet",
    "Honda",
    "Renault",
    "Nissan",
    "Volvo",
    "Mercedes-Benz",
    "Caoa Chery",
    "Caoa Chery/Chery",
    "Land Rover",
    "Walk",
  ]);

  it("takes the first brand named, with aliases and shared names", () => {
    expect(match("Fiat Automóveis")).toEqual(["Fiat"]);
    expect(match("General Motors do Brasil Chevrolet")).toEqual(["GM - Chevrolet"]);
    expect(match("Renault Sandero made by Nissan South Africa")).toEqual(["Renault"]);
    expect(match("Chery assembled by Chery Socma S.A.")).toEqual(["Caoa Chery", "Caoa Chery/Chery"]);
    expect(match("Jaguar Land Rover")).toEqual(["Land Rover"]);
  });

  it("uses fallback names only when no brand appears", () => {
    expect(match("General Motors South Africa")).toEqual(["GM - Chevrolet"]);
  });

  it("skips heavy vehicles, motorcycles and ambiguous brand names", () => {
    expect(match("Honda Motorcycles")).toEqual([]);
    expect(match("Volvo Trucks")).toEqual([]);
    expect(match("Mercedes-Benz car & SUV & commercial truck")).toEqual(["Mercedes-Benz"]);
    expect(match("Walk-behind tractors")).toEqual([]);
    expect(match("Arab American Vehicles")).toEqual([]);
  });
});
