import { describe, expect, it } from "vitest";
import type { PbevRow } from "../../src/catalog/inmetro.ts";
import { parseModelName } from "../../src/catalog/modelName.ts";
import { derivePropulsion } from "../../src/catalog/indexFormat.ts";
import { brandKey, createInmetroMatcher } from "./match.ts";

function row(overrides: Partial<PbevRow>): PbevRow {
  return {
    table: 2026,
    category: "Compacto",
    brand: "FIAT",
    model: "ARGO",
    version: "1.0",
    engine: "1.0-6V",
    size: "compacto",
    body: null,
    fourWheelDrive: false,
    propulsion: "combustao",
    fuel: "flex",
    transmission: "manual",
    gears: 5,
    airConditioning: true,
    steering: "eletrica",
    consumption: {
      ethanolCity: 9.4,
      ethanolHighway: 10.4,
      fuelCity: 13.6,
      fuelHighway: 14.5,
      electricCity: null,
      electricHighway: null,
    },
    rangeKm: null,
    energyMjKm: 1.52,
    ...overrides,
  };
}

const rows: PbevRow[] = [
  row({}),
  row({ version: "DRIVE 1.3 AT", engine: "1.3-8V", transmission: "cvt", gears: 7 }),
  row({ brand: "VW", model: "T CROSS", version: "COMFORTLINE 200TSI AUTOMATICO", engine: "1.0-12V", transmission: "automatico", gears: 6, body: "suv" }),
  row({ brand: "VW", model: "T CROSS", version: "HIGHLINE 250TSI", engine: "1.4-16V", transmission: "automatico", gears: 6, body: "suv" }),
  row({ brand: "CHEVROLET", model: "ONIX", version: "10TAT LT1", engine: "1.0-12V T", transmission: "automatico", gears: 6 }),
  row({ brand: "CHEVROLET", model: "ONIX PLUS", version: "10TAT LT1", engine: "1.0-12V T", transmission: "automatico", gears: 6 }),
  row({ brand: "BYD", model: "KING", version: "GL", engine: "1.5-16V", propulsion: "hibrido-plugin", fuel: "gasolina", transmission: "automatico", gears: null }),
  row({ brand: "BYD", model: "DOLPHIN MINI", version: "GS EV", engine: "Elétrico", propulsion: "eletrico", fuel: "eletrico", transmission: null, gears: null }),
  row({ brand: "TOYOTA", model: "HILUX DIESEL 4X4 AT", version: "SRX", engine: "2.8-16V", fuel: "diesel", transmission: "automatico", gears: 6, body: "picape" }),
];

const match = createInmetroMatcher(rows);

function fipe(brand: string, model: string, fuel = "Flex") {
  const attributes = parseModelName(model);
  return { brand, model, fuel, attributes, propulsion: derivePropulsion(fuel, attributes) };
}

describe("brandKey", () => {
  it("aligns FIPE and PBEV brand names", () => {
    expect(brandKey("VW - VolksWagen")).toBe(brandKey("VW"));
    expect(brandKey("GM - Chevrolet")).toBe(brandKey("CHEVROLET"));
    expect(brandKey("Caoa Changan")).toBe(brandKey("CAOACHANGAN"));
    expect(brandKey("Mercedes-Benz")).toBe(brandKey("MERCEDES-BENZ"));
    expect(brandKey("Citroën")).toBe(brandKey("CITROEN"));
  });
});

describe("createInmetroMatcher", () => {
  it("matches by model, engine and transmission, preferring version words", () => {
    expect(match(fipe("Fiat", "ARGO DRIVE 1.3 8V Flex Aut."))).toMatchObject({
      version: "DRIVE 1.3 AT",
      transmission: "cvt",
      gears: 7,
      confidence: "exact",
    });
    expect(match(fipe("Fiat", "ARGO 1.0 6V Flex."))).toMatchObject({
      version: "1.0",
      confidence: "fuzzy",
    });
  });

  it("normalizes hyphens and glued version words", () => {
    expect(
      match(fipe("VW - VolksWagen", "T-Cross Comfortline 200 TSI 1.0 Flex Aut.")),
    ).toMatchObject({ version: "COMFORTLINE 200TSI AUTOMATICO", body: "suv", confidence: "exact" });
    expect(
      match(fipe("VW - VolksWagen", "T-Cross Highline 250 TSI 1.4 Flex Aut.")),
    ).toMatchObject({ version: "HIGHLINE 250TSI" });
  });

  it("prefers the longest model name", () => {
    expect(match(fipe("GM - Chevrolet", "ONIX PLUS LT 1.0 12V TB Flex Aut."))?.model).toBe(
      "ONIX PLUS",
    );
    expect(match(fipe("GM - Chevrolet", "ONIX HATCH LT 1.0 12V TB Flex 5p Aut."))?.model).toBe(
      "ONIX",
    );
  });

  it("rejects conflicting engine, transmission, fuel or propulsion", () => {
    expect(match(fipe("Fiat", "ARGO 1.8 16V Flex"))).toBeNull();
    expect(match(fipe("Fiat", "ARGO DRIVE 1.3 8V Flex Mec."))).toBeNull();
    expect(match(fipe("Toyota", "Hilux SRX 4x4 2.8 TDI 16V Aut.", "Gasolina"))).toBeNull();
    expect(match(fipe("BYD", "Dolphin Mini GL", "Gasolina"))).toBeNull();
  });

  it("matches electric and plug-in versions, ignoring equipment words in models", () => {
    expect(match(fipe("BYD", "Dolphin Mini GS (Elétrico)", "Elétrico"))).toMatchObject({
      propulsion: "eletrico",
      confidence: "exact",
    });
    expect(match(fipe("BYD", "King GL 1.5 16V Aut. (Hibrido)", "Híbrido"))).toMatchObject({
      propulsion: "hibrido-plugin",
      confidence: "exact",
    });
    expect(
      match(fipe("Toyota", "Hilux CD SRX 4x4 2.8 TDI Diesel Aut.", "Diesel")),
    ).toMatchObject({ model: "HILUX DIESEL 4X4 AT", body: "picape" });
  });

  it("uses pickup cab codes glued to the engine and skips hybrid rows for combustion cars", () => {
    const strada = createInmetroMatcher([
      row({ model: "STRADA", version: "FREEDOM CS13", engine: "1.3-8V", body: "picape" }),
      row({ model: "STRADA", version: "FREEDOM CD13", engine: "1.3-8V", body: "picape" }),
    ]);
    expect(strada(fipe("Fiat", "Strada Freedom 1.3 Flex 8V CD"))?.version).toBe("FREEDOM CD13");
    expect(strada(fipe("Fiat", "Strada Freedom 1.3 Flex 8V CS"))?.version).toBe("FREEDOM CS13");

    const renegade = createInmetroMatcher([
      row({ brand: "JEEP", model: "RENEGADE", version: "LONGIT HYB", engine: "1.3T-16V", transmission: "automatico" }),
    ]);
    expect(renegade(fipe("Jeep", "Renegade Longitude T270 1.3 Turbo 4x2 Aut."))).toBeNull();
  });

  it("rejects a different valve count and follows the FIPE name on turbo", () => {
    const logan = createInmetroMatcher([
      row({ brand: "RENAULT", model: "LOGAN", version: "EXPRESSION", engine: "1.6-16V" }),
    ]);
    expect(logan(fipe("Renault", "LOGAN Dyna. EasyR Hi-Flex 1.6 8V"))).toBeNull();

    const onix = createInmetroMatcher([
      row({ brand: "CHEVROLET", model: "ONIX PLUS", version: "MT", engine: "1.0T - 12V" }),
      row({ brand: "CHEVROLET", model: "ONIX PLUS", version: "MT", engine: "1.0 - 12V" }),
    ]);
    expect(onix(fipe("GM - Chevrolet", "ONIX PLUS 1.0 12V Mec."))?.engine).toBe("1.0 - 12V");
    expect(onix(fipe("GM - Chevrolet", "ONIX PLUS 1.0 12V TB Mec."))?.engine).toBe("1.0T - 12V");

    // Only a turbo row exists: a FIPE name that omits "turbo" still matches.
    const compass = createInmetroMatcher([
      row({ brand: "JEEP", model: "COMPASS", version: "LIMITED T", engine: "1.3T-16V", transmission: "automatico" }),
    ]);
    expect(compass(fipe("Jeep", "COMPASS LIMITED 1.3 Flex Aut."))).not.toBeNull();
  });

  it("returns null for unknown brands or models", () => {
    expect(match(fipe("Ferrari", "296 GTB"))).toBeNull();
    expect(match(fipe("Fiat", "Pulse Drive 1.3 Flex"))).toBeNull();
  });
});
