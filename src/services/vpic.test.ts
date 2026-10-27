import { describe, expect, it, vi } from "vitest";
import { decodeVinWithVpic, parseVpicValues } from "./vpic";

// Trimmed from DecodeVinValues/1HGCM82633A004352 and /9BGKS48U0LB123456.
const accord = {
  Make: "HONDA",
  Model: "Accord",
  ModelYear: "2003",
  Trim: "EX-V6",
  BodyClass: "Coupe",
  FuelTypePrimary: "Gasoline",
  DisplacementL: "2.998832712",
  PlantCity: "MARYSVILLE",
  PlantCountry: "UNITED STATES (USA)",
  Series: "",
  EngineHP: null,
  TPMS: "Not Applicable",
};
const brazilian = {
  Make: "",
  Model: "",
  ModelYear: "",
  ErrorCode: "1,7",
  VehicleDescriptor: "9BGKS48U*LB",
};

describe("vPIC", () => {
  it("reads model, year and details", () => {
    expect(parseVpicValues(accord)).toEqual({
      make: "Honda",
      model: "Accord",
      modelYear: 2003,
      trim: "EX-V6",
      bodyClass: "Coupe",
      fuel: "Gasoline",
      displacement: 3,
      plant: "Marysville, United States",
    });
  });

  it("returns null without a model (most Brazilian chassis)", () => {
    expect(parseVpicValues(brazilian)).toBeNull();
    expect(parseVpicValues({ Make: "VOLKSWAGEN", Model: "", ModelYear: "1997" })).toBeNull();
  });

  it("requests the VIN", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ Results: [accord] })));
    const vehicle = await decodeVinWithVpic("1HGCM82633A004352", { fetch });
    expect(vehicle?.model).toBe("Accord");
    expect(fetch).toHaveBeenCalledWith(
      "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/1HGCM82633A004352?format=json",
      expect.anything(),
    );
  });
});
