import { describe, expect, it } from "vitest";
import { formatSpec } from "./wikidata";

describe("formatSpec", () => {
  it("marks the model line's size and mass as approximate", () => {
    expect(formatSpec("length", [3.998, 3.998])).toBe("≈ 4,00 m");
    expect(formatSpec("length", [3.95, 4.1])).toBe("≈ 3,95–4,10 m");
    expect(formatSpec("mass", [1150, 1150])).toBe("≈ 1.150 kg");
  });
});
