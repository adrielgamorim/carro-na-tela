import { describe, expect, it } from "vitest";
import { stellantisAsOpen, stellantisYears, uploadYear } from "./stellantis-open.ts";
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
    expect(stellantisYears({ modelYear: null, title: "Ram Rampage 2.0 Gasolina Laramie", pageTitle: "Rampage 2023 a 2025", file: "" })).toEqual([2023, 2025]);
    expect(stellantisYears({ modelYear: 2022, title: "x", pageTitle: "Jeep® Compass MY 2022", file: "" })).toEqual([2022, 2022]);
    expect(stellantisYears({ modelYear: null, title: "Citroën C3 1.0 Live – 2026/2027", pageTitle: "Citroën C3", file: "" })).toEqual([2027, 2027]);
    expect(stellantisYears({ modelYear: null, title: "JEEP AVENGER ALTITUDE T2 0 0 MHEV FLEX CVT – 27/27", pageTitle: "Novo Avenger", file: "" })).toEqual([2027, 2027]);
    expect(stellantisYears({ modelYear: null, title: "JEEP WRANGLER RUBICON 2.0 TURBO AT8 202 4", pageTitle: "Jeep®  Wrangler", file: "" })).toEqual([2024, 2024]);
    // Not a date: "Atualizada em 12/04/19".
    expect(stellantisYears({ modelYear: null, title: "TORO Rev.2 Atualizada em 12/04/19", pageTitle: "Toro", file: "" })).toBeUndefined();
  });

  it("puts a sheet's own year before its page's span", () => {
    expect(stellantisYears({ modelYear: null, title: "RAM 1500 MY25 LARAMIE", pageTitle: "Ram 1500 2020 a 2024", file: "" })).toEqual([2025, 2025]);
  });

  it("dates a page that names no year by its PDF's upload, that year and the next", () => {
    // uniqid 688a33534a76c: 0x688a3353 seconds, July 2025.
    expect(uploadYear("259-fichatecnicafastbackabarthflex13-688a33534a76c.pdf")).toBe(2025);
    expect(uploadYear("ficha.pdf")).toBeUndefined();
    expect(stellantisYears({ modelYear: null, title: "Peugeot Expert 2.2 Turbo d iesel Cargo", pageTitle: "Peugeot Expert", file: "x-688a33534a76c.pdf" })).toEqual([2025, 2026]);
  });

  it("joins the letters and digits the PDF split", () => {
    const peugeot = stellantisAsOpen(sheet({ brand: "peugeot", pageTitle: "Peugeot 208", modelYear: 2027, title: "P eugeot 208 A llure T urbo 200 AT – 2026/2027" }))!;
    expect(peugeot).toMatchObject({ line: "208", trims: ["allure"], turbo: true });
    const avenger = stellantisAsOpen(sheet({ brand: "jeep", pageTitle: "Novo Avenger", modelYear: 2027, title: "JEEP AVENGER L IMITED T2 0 0 MHEV FLEX CVT – 27/27" }))!;
    expect(avenger).toMatchObject({ trims: ["limited"], turbo: true, hybrid: true });
    // "3 500" is the line, "6,7" the engine.
    expect(stellantisAsOpen(sheet({ brand: "ram", pageTitle: "3500 2022 a 2024", modelYear: null, title: "RAM 3 500 6,7L AT6 4x4" }))).toMatchObject({ line: "3500", engineLiters: 6.7 });
  });

  it("reads lines FIPE names otherwise", () => {
    // A number is a line, a year is not.
    expect(stellantisAsOpen(sheet({ brand: "ram", pageTitle: "2500 MY 2021", title: "RAM 2500 LARAMIE 6,7L AT6 4x4" }))?.line).toBe("2500");
    expect(stellantisAsOpen(sheet({ brand: "leapmotor", pageTitle: "C10 Ultra-Híbrido (REEV)", title: "Leapmotor C10 Ultra - Híbrido ( REEV )" }))).toMatchObject({ line: "c10", trims: [], hybrid: true });
    expect(stellantisAsOpen(sheet({ brand: "citroen", pageTitle: "Citroën Aircross", title: "Citroën Aircross XTR 7 Turbo 200 AT – 2026/2027" }))?.line).toBe("aircross7");
    expect(stellantisAsOpen(sheet({ brand: "citroen", pageTitle: "Citroën Aircross", title: "Citroën Aircross Feel Turbo 200 – 2025/2026" }))?.line).toBe("aircross");
  });

  it("leaves open the turbo and gearbox of lines whose names FIPE leaves out", () => {
    const rampage = stellantisAsOpen(sheet({ brand: "ram", pageTitle: "Rampage MY26", title: "Ram Rampage 2.0 Gasolina R /T" }))!;
    expect(rampage.turbo).toBeUndefined();
    const ram = stellantisAsOpen(sheet({ brand: "ram", pageTitle: "2500 MY 2021", title: "RAM 2500 LARAMIE 6,7L AT6 4x4" }))!;
    expect(ram.turbo).toBeUndefined();
    expect(ram.transmission).toBeUndefined();
  });

  it("reads engine, fuel, gearbox and cab from the title", () => {
    const toro = stellantisAsOpen(sheet({ title: "FIAT TORO VOLCANO TURBODIESEL AT9 4x4" }))!;
    expect(toro).toMatchObject({ line: "toro", fipeBrands: ["Fiat"], trims: ["volcano"], turbo: true, diesel: true, transmission: "automatico" });
    const strada = stellantisAsOpen(sheet({ pageTitle: "Strada MY 2025", title: "Fiat Strada Endurance Cabine Plus 1.3 Manual" }))!;
    expect(strada).toMatchObject({ engineLiters: 1.3, cab: "ce", transmission: "manual" });
    // The title does not say the fuel: either.
    expect(strada.diesel).toBeUndefined();
    const commander = stellantisAsOpen(sheet({ brand: "jeep", pageTitle: "Jeep® Commander MY 2025", title: "JEEP COMMANDER BLACKHAWK 2.0 HURRICANE AT9" }))!;
    // The Hurricane is a turbo ("Commander Black Hurricane 2.0 4x4 TB Aut").
    expect(commander).toMatchObject({ line: "commander", diesel: false, turbo: true });
  });

  it("gives a van's sheet only to versions naming one of its words", () => {
    expect(stellantisAsOpen(sheet({ pageTitle: "Fiat Ducato MY26", title: "FIAT DUCATO MINIBUS LUXO" }))?.onlyNamed).toBe(true);
    expect(stellantisAsOpen(sheet({ title: "FIAT TORO ENDURANCE TURBO 270 FLEX AT6" }))?.onlyNamed).toBeUndefined();
  });

  it("joins a van's words the PDF split, and leaves its turbo open", () => {
    const jumper = stellantisAsOpen(sheet({ brand: "citroen", pageTitle: "Citroën Jumper 2018 a 2023", title: "Citroën Jumper 2.2 16V C argo L 3 H 2" }))!;
    expect(jumper).toMatchObject({ line: "jumper", trims: ["cargo", "l3h2"], engineLiters: 2.2 });
    // All turbodiesel; "FIAT DUCATO MAXI CARGO" says neither, FIPE writes "Turbo" for some.
    expect(jumper.turbo).toBeUndefined();
    expect(stellantisAsOpen(sheet({ pageTitle: "Fiat Ducato MY26", title: "FIAT DUCATO MAXI CARGO" }))?.trims).toEqual(["maxicargo"]);
    expect(stellantisAsOpen(sheet({ brand: "peugeot", pageTitle: "Peugeot Expert", modelYear: 2025, title: "Peugeot Expert 2.2 Turbo d iesel Vitr é" }))).toMatchObject({
      trims: ["vitre"],
      diesel: true,
    });
  });
});
