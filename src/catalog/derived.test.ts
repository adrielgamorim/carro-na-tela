import { describe, expect, it } from "vitest";
import { derivedSpecs } from "./derived";

describe("derivedSpecs", () => {
  it("works out the ratios of an Audi A4 2.0 TFSI", () => {
    expect(
      derivedSpecs({ engineLiters: 2, powerCv: 190, torqueKgfm: 32.6, weightKg: 1405, tankLiters: 54, highwayKmL: 13.2 }),
    ).toEqual([
      ["Potência específica", "95,0 cv/litro"],
      ["Torque específico", "16,3 kgfm/litro"],
      ["Peso/potência", "7,4 kg/cv"],
      ["Peso/torque", "43,1 kg/kgfm"],
      ["Autonomia na estrada", "≈ 713 km"],
    ]);
  });

  it("marks a line's weight as approximate and skips what is missing", () => {
    expect(derivedSpecs({ powerCv: 75, weightKg: 1000, weightApprox: true })).toEqual([["Peso/potência", "≈ 13,3 kg/cv"]]);
    expect(derivedSpecs({ engineLiters: 0, powerCv: 204 })).toEqual([]);
  });
});
