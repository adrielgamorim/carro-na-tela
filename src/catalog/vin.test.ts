import { describe, expect, it } from "vitest";
import { decodeVin, normalizeVin, vinCheckDigitValid, vinModelYear, vinProblem } from "./vin";
import type { WmiFile } from "./vin";

const file: WmiFile = {
  version: 1,
  generatedAt: "2026-10-26T12:00:00.000Z",
  source: "https://en.wikipedia.org/wiki/Vehicle_identification_number",
  countries: [
    ["9A", "9E", "Brasil"],
    ["91", "90", "Brasil"],
    ["1A", "10", "Estados Unidos"],
  ],
  wmi: {
    "9BW": [{ m: "Volkswagen do Brasil", c: "Brasil", b: ["VW - VolksWagen"] }],
    "98R": [{ m: "Chery", c: "Brasil", b: ["Caoa Chery", "Caoa Chery/Chery"] }],
    "1HG": [{ m: "Honda car made by Honda of America Mfg. in Ohio", c: "Estados Unidos", b: ["Honda"] }],
  },
};
const now = new Date("2026-10-26T12:00:00Z");

describe("VIN format", () => {
  it("normalizes and explains invalid input", () => {
    expect(normalizeVin(" 9bw ab45u-0lt.000000 ")).toBe("9BWAB45U0LT000000");
    expect(vinProblem("9BWAB45U0LT000000")).toBeNull();
    expect(vinProblem("")).toMatch(/Digite/);
    expect(vinProblem("9BWAB45U0LT00000")).toMatch(/17 caracteres; este tem 16/);
    expect(vinProblem("9BWAB45UOLT000000")).toMatch(/I, O e Q.*: O\./);
    expect(vinProblem("9BWAB45U#LT000000")).toMatch(/inválidos: #/);
  });

  it("checks the North American check digit", () => {
    expect(vinCheckDigitValid("1HGCM82633A004352")).toBe(true);
    expect(vinCheckDigitValid("1HGCM82643A004352")).toBe(false);
    expect(vinCheckDigitValid("11111111111111111")).toBe(true);
  });
});

describe("vinModelYear", () => {
  it("takes the latest year up to next year outside North America", () => {
    expect(vinModelYear("9BWAB45U0LT000000", now)).toBe(2020);
    expect(vinModelYear("9BWAB45U0TT000000", now)).toBe(2026);
    // "V" is 1997 or 2027; next year still counts.
    expect(vinModelYear("9BWZZZ377VT004251", now)).toBe(2027);
    expect(vinModelYear("9BWZZZ377VT004251", new Date("2025-06-01"))).toBe(1997);
    expect(vinModelYear("9BWAB45U0UT000000", now)).toBeNull();
  });

  it("uses the 7th character for the cycle in North America", () => {
    expect(vinModelYear("1HGCM82633A004352", now)).toBe(2003);
    expect(vinModelYear("1HGCV1F33LA000000", now)).toBe(2020);
  });
});

describe("decodeVin", () => {
  it("finds the maker, its FIPE brands and the country", () => {
    expect(decodeVin(file, "98RAB12C0PA000000", now)).toEqual({
      vin: "98RAB12C0PA000000",
      wmi: "98R",
      country: "Brasil",
      makers: [{ m: "Chery", c: "Brasil", b: ["Caoa Chery", "Caoa Chery/Chery"] }],
      brands: ["Caoa Chery", "Caoa Chery/Chery"],
      modelYear: 2023,
      checkDigitValid: false,
    });
  });

  it("falls back to the country ranges for unknown makers", () => {
    const info = decodeVin(file, "93ZAB12C0PA000000", now);
    expect(info).toMatchObject({ wmi: "93Z", country: "Brasil", makers: [], brands: [] });
    expect(decodeVin(file, "1ZZAB12C0PA000000", now).country).toBe("Estados Unidos");
    expect(decodeVin(file, "LZZAB12C0PA000000", now).country).toBeNull();
  });
});
