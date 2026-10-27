import { describe, expect, it } from "vitest";
import { formatDepreciation, versionDepreciation } from "./depreciation";
import { fleetOrigin } from "./fleet";

describe("versionDepreciation", () => {
  it("averages the yearly loss between the oldest and newest priced years", () => {
    const result = versionDepreciation([
      { modelYear: null, price: 120000 },
      { modelYear: 2024, price: 100000 },
      { modelYear: 2022, price: 90000 },
      { modelYear: 2020, price: 81000 },
      { modelYear: 2019, price: null },
    ]);
    expect(result).toMatchObject({ fromYear: 2020, toYear: 2024 });
    expect(result!.perYear).toBeCloseTo(1 - 0.81 ** 0.25, 6);
    expect(formatDepreciation(result!)).toBe("5,1% ao ano (2020 → 2024)");
  });

  it("needs two priced model years", () => {
    expect(versionDepreciation([{ modelYear: 2024, price: 1 }, { modelYear: null, price: 2 }])).toBeNull();
  });
});

describe("fleetOrigin", () => {
  it("calls a line imported when most of its fleet is", () => {
    const line = { family: "x", total: 100, rank: 1, years: {} };
    expect(fleetOrigin({ ...line, imported: 60 })).toBe("importado");
    expect(fleetOrigin({ ...line, imported: 5 })).toBe("nacional");
    expect(fleetOrigin(line)).toBeNull();
  });
});
