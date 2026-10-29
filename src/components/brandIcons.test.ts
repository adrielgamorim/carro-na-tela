import { describe, expect, it } from "vitest";
import { brandIconKeys } from "./brandIconKeys";
import { brandLogoKeys } from "./brandLogoKeys";
import { brandIconUrl, brandLogoUrl } from "./brandIcons";

describe("brandIconUrl", () => {
  it("maps FIPE brand names to their logo, accents and prefixes included", () => {
    expect(brandIconUrl("GM - Chevrolet")).toBe("/brands/chevrolet.svg");
    expect(brandIconUrl("VW - VolksWagen")).toBe("/brands/volkswagen.svg");
    expect(brandIconUrl("Citroën")).toBe("/brands/citroen.svg");
    expect(brandIconUrl("Kia Motors")).toBe("/brands/kia.svg");
    expect(brandIconUrl("ASTON MARTIN")).toBe("/brands/astonmartin.svg");
  });

  it("is null for brands without a logo", () => {
    expect(brandIconUrl("Mercedes-Benz")).toBeNull();
    expect(brandIconUrl("BYD")).toBeNull();
  });

  it("has a file for every key (npm run build:brand-icons)", () => {
    const files = Object.keys(import.meta.glob("/public/brands/*.svg"));
    expect(brandIconKeys.filter((key) => !files.includes(`/public/brands/${key}.svg`))).toEqual([]);
  });
});

describe("brandLogoUrl", () => {
  it("maps FIPE brand names to their color logo, partners' names included", () => {
    expect(brandLogoUrl("Mercedes-Benz")).toBe("/brands/logos/mercedesbenz.png");
    expect(brandLogoUrl("GM - Chevrolet")).toBe("/brands/logos/chevrolet.png");
    expect(brandLogoUrl("Caoa Chery/Chery")).toBe("/brands/logos/chery.png");
    expect(brandLogoUrl("CHANA")).toBe("/brands/logos/changan.png");
    expect(brandLogoUrl("GREAT WALL")).toBe("/brands/logos/gwm.png");
    expect(brandLogoUrl("Alfa Romeo")).toBe("/brands/logos/alfaromeo.png");
    expect(brandLogoUrl("Fibravan")).toBeNull();
  });

  it("has a file for every key (npm run fetch:brand-logos)", () => {
    const files = Object.keys(import.meta.glob("/public/brands/logos/*.png"));
    expect(brandLogoKeys.filter((key) => !files.includes(`/public/brands/logos/${key}.png`))).toEqual([]);
  });
});
