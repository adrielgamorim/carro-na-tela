import { describe, expect, it } from "vitest";
import {
  angleOf,
  isNotTheCar,
  isNotTheCarFile,
  namesTheModel,
  photoYear,
  pickGallery,
  recencyHint,
  seriesOf,
  subcategoryRank,
} from "./gallery.ts";
import type { CommonsFile } from "./gallery.ts";

const file = (name: string, fields: Partial<CommonsFile> = {}): CommonsFile => ({
  file: name,
  thumb: `https://upload.wikimedia.org/thumb/${name}/960px-${name}`,
  width: 4000,
  height: 2500,
  categories: [],
  ...fields,
});
const now = new Date("2026-10-28");

describe("gallery", () => {
  it("tells the angle by the name, then by the categories", () => {
    expect(angleOf("2022 Fiat Pulse Impetus T200 (Brazil) front view.png")).toBe("frente");
    expect(angleOf("2024 Fiat Pulse 1.0 Turbo 200 Audace (rear).jpg")).toBe("traseira");
    expect(angleOf("2023 Fiat Pulse Impetus (Colombia) interior.jpg")).toBe("interior");
    expect(angleOf("AstonMartinDB-S-1969-flanc.jpg")).toBe("outra");
    expect(angleOf("At São Paulo 2023 007.jpg", ["Interiors of Chevrolet Onix (GEM)"])).toBe("interior");
    expect(angleOf("2023 Aston Martin DB12.jpg")).toBe("outra");
  });

  it("leaves out racing, taxis, toys and details", () => {
    expect(isNotTheCarFile("Aston Martin DB9 Mansory Cyrus.jpg")).toBe(true);
    expect(isNotTheCar("Chevrolet Onix in competition")).toBe(true);
    expect(isNotTheCar("Chevrolet Onix taxis")).toBe(true);
    expect(isNotTheCar("Cars with Fiat Global Small Engine")).toBe(false);
    expect(isNotTheCarFile("Fiat Pulse engine.jpg")).toBe(true);
    expect(isNotTheCarFile("Fiat Pulse badge.jpg")).toBe(true);
    expect(isNotTheCarFile("2022 Fiat Pulse front view.png")).toBe(false);
  });

  it("reads the model year, not the model's own number", () => {
    expect(photoYear("2022 Fiat Pulse 1.3 Drive.jpg", [], "Fiat Pulse")).toBe(2022);
    expect(photoYear("Fiat Pulse 1.3 Drive 2023.jpg", [], "Fiat Pulse")).toBe(2023);
    expect(photoYear("Peugeot 2008 Allure 2021.jpg", [], "Peugeot 2008")).toBe(2021);
    expect(photoYear("Peugeot 2008 GT.jpg", [], "Peugeot 2008")).toBeUndefined();
    expect(photoYear("Onix.jpg", ["2019 Chevrolet Onix"], "Chevrolet Onix")).toBe(2019);
    // The date the photo was taken is not the car's year.
    expect(photoYear("1st Honda Civic -- 03-21-2012.JPG", [], "Honda Civic")).toBeUndefined();
    expect(photoYear("Honda Civic (K20 SVG) - 7 June 2026.jpg", [], "Honda Civic")).toBeUndefined();
    expect(photoYear("Belo Horizonte (December 2024) 482.jpg", [], "Hyundai HB20")).toBeUndefined();
    expect(photoYear("2015 Volkswagen Gol Trend - 2024-04-29.jpg", [], "Volkswagen Gol")).toBe(2015);
  });

  it("walks into the generations before variants and other categories", () => {
    expect(subcategoryRank("Toyota Corolla", "Toyota Corolla (E210)")).toBe(0);
    expect(subcategoryRank("Toyota Corolla (E210)", "Toyota Corolla (E210) sedan")).toBe(1);
    expect(subcategoryRank("Chevrolet Onix (GEM)", "Chevrolet Onix (GEM) hatchback")).toBe(1);
    expect(subcategoryRank("Toyota Corolla (E210)", "Toyota Corolla (E210, Japan)")).toBe(1);
    expect(subcategoryRank("Toyota Corolla (E210)", "Toyota Corolla Hybrid (E210)")).toBe(1);
    expect(subcategoryRank("Toyota Corolla", "Toyota Corolla Verso")).toBe(1);
    expect(subcategoryRank("Fiat Pulse", "Abarth Pulse")).toBe(2);
    // Newest first: E210 before E20, Mk8 before Mk7.
    expect(recencyHint("Toyota Corolla", "Toyota Corolla (E210)")).toBeGreaterThan(recencyHint("Toyota Corolla", "Toyota Corolla (E20)"));
    expect(recencyHint("Volkswagen Golf", "Volkswagen Golf Mk8")).toBe(8);
    expect(recencyHint("Honda Civic", "Honda Civic (tenth generation)")).toBe(10);
  });

  it("leaves out photos older than the line's first year in the catalog", () => {
    const files = [file("1976 Toyota Corolla front.jpg"), file("2021 Toyota Corolla front.jpg")];
    const gallery = pickGallery(files, { label: "Toyota Corolla", firstYear: 2009, now });
    expect(gallery.map((photo) => photo.file)).toEqual(["2021 Toyota Corolla front.jpg"]);
  });

  it("keeps photos named after the model, not street scenes", () => {
    expect(namesTheModel("2023 Hyundai HB20S 1.0.jpg", "Hyundai HB20")).toBe(true);
    expect(namesTheModel("VW Gol Sedán Trendline 2009.jpg", "Volkswagen Gol")).toBe(true);
    expect(namesTheModel("Belo Horizonte (December 2024) 482.jpg", "Hyundai HB20")).toBe(false);
  });

  it("knows the photos of one shoot and a crop", () => {
    expect(seriesOf("Aston Martin DB9 001 (2261257153).jpg")).toBe(seriesOf("Aston Martin DB9 001 (2262052250).jpg"));
    expect(seriesOf("Aston Martin DB12 Auto Zuerich 2023 1X7A1462.jpg")).toBe(
      seriesOf("Aston Martin DB12 Auto Zuerich 2023 1X7A1463.jpg"),
    );
    expect(seriesOf("2022 Fiat Pulse.jpg")).toBe(seriesOf("2022 Fiat Pulse (cropped).jpg"));
    expect(seriesOf("2022 Fiat Pulse.jpg")).not.toBe(seriesOf("2024 Fiat Pulse.jpg"));
  });

  it("picks a few photos per generation, one of each angle first", () => {
    const generations = [
      { file: "a.jpg", from: 2012, to: 2019 },
      { file: "b.jpg", from: 2019, to: null },
    ];
    const files = [
      file("2014 Chevrolet Onix front.jpg"),
      file("2021 Chevrolet Onix front.jpg"),
      file("2021 Chevrolet Onix rear.jpg"),
      file("2021 Chevrolet Onix interior.jpg"),
      file("2021 Chevrolet Onix interior (cropped).jpg"),
      file("2022 Chevrolet Onix taxi.jpg"),
      file("Chevrolet Onix.jpg"),
      file("2021 Chevrolet Onix small.jpg", { width: 640, height: 480 }),
    ];
    const gallery = pickGallery(files, { label: "Chevrolet Onix", generations, now });
    expect(gallery.map((photo) => `${photo.from}-${photo.to} ${photo.angle} ${photo.file}`)).toEqual([
      "2012-2019 frente 2014 Chevrolet Onix front.jpg",
      "2019-2027 frente 2021 Chevrolet Onix front.jpg",
      "2019-2027 traseira 2021 Chevrolet Onix rear.jpg",
      "2019-2027 interior 2021 Chevrolet Onix interior.jpg",
    ]);
  });

  it("groups lines without generations in five-year windows", () => {
    const gallery = pickGallery([file("2023 Aston Martin DB12.jpg"), file("Aston Martin DB12.jpg")], {
      label: "Aston Martin DB12",
      now,
    });
    expect(gallery.map((photo) => `${photo.from}-${photo.to}`)).toEqual(["2021-2025"]);
    const undated = pickGallery([file("Aston Martin DB12.jpg")], { label: "Aston Martin DB12", now });
    expect(undated.map((photo) => `${photo.from}-${photo.to}`)).toEqual(["1900-2027"]);
  });
});
