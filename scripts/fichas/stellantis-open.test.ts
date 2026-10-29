import { describe, expect, it } from "vitest";
import { stellantisAsOpen, stellantisYears } from "./stellantis-open.ts";
import type { ReadSheet } from "./sheets.ts";

const sheet = (fields: Partial<ReadSheet>): ReadSheet => ({
  id: 1,
  brand: "fiat",
  pageTitle: "Fiat Toro MY 2023",
  title: "",
  modelYear: 2023,
  page: "",
  url: "",
  file: "",
  specs: { powerCv: 185 },
  ...fields,
});

describe("Stellantis sheets matched the open way", () => {
  it("takes the years of a span, the model year, or the year in the title", () => {
    expect(stellantisYears({ modelYear: null, title: "Ram Rampage 2.0 Gasolina Laramie", pageTitle: "Rampage 2023 a 2025" })).toEqual([2023, 2025]);
    expect(stellantisYears({ modelYear: 2022, title: "x", pageTitle: "Jeep® Compass MY 2022" })).toEqual([2022, 2022]);
    expect(stellantisYears({ modelYear: null, title: "Citroën C3 1.0 Live – 2026/2027", pageTitle: "Citroën C3" })).toEqual([2027, 2027]);
  });

  it("reads engine, fuel, gearbox and cab from the title", () => {
    const toro = stellantisAsOpen(sheet({ title: "FIAT TORO VOLCANO TURBODIESEL AT9 4x4" }))!;
    expect(toro).toMatchObject({ line: "toro", fipeBrands: ["Fiat"], trims: ["volcano"], turbo: true, diesel: true, transmission: "automatico" });
    const strada = stellantisAsOpen(sheet({ pageTitle: "Strada MY 2025", title: "Fiat Strada Endurance Cabine Plus 1.3 Manual" }))!;
    expect(strada).toMatchObject({ engineLiters: 1.3, cab: "ce", transmission: "manual" });
    // The title does not say the fuel: either.
    expect(strada.diesel).toBeUndefined();
    const commander = stellantisAsOpen(sheet({ brand: "jeep", pageTitle: "Jeep® Commander MY 2025", title: "JEEP COMMANDER BLACKHAWK 2.0 HURRICANE AT9" }))!;
    expect(commander).toMatchObject({ line: "commander", diesel: false, turbo: false });
  });

  it("gives a van's sheet only to versions naming one of its words", () => {
    expect(stellantisAsOpen(sheet({ pageTitle: "Fiat Ducato MY26", title: "FIAT DUCATO MINIBUS LUXO" }))?.onlyNamed).toBe(true);
    expect(stellantisAsOpen(sheet({ title: "FIAT TORO ENDURANCE TURBO 270 FLEX AT6" }))?.onlyNamed).toBeUndefined();
  });
});
