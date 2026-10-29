import { describe, expect, it } from "vitest";
import { bodyOf, photosOfBody, versionBody } from "../../src/catalog/gallery.ts";
import type { GalleryPhoto as AppPhoto } from "../../src/catalog/gallery.ts";
import {
  angleOf,
  generationCodes,
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

  it("tells the body style by the name, not the line's own name", () => {
    expect(bodyOf("2017 Dacia Logan MCV Laureate DCi 1.5 Front", "Dacia Logan")).toBe("perua");
    expect(bodyOf("Dacia Logan MCV Van (33043469088)", "Dacia Logan")).toBe("furgao");
    expect(bodyOf("White Dacia Logan Pick-Up", "Dacia Logan")).toBe("picape");
    expect(bodyOf("A4allroadDetroit Auto Show 2016", "Audi A4")).toBe("perua");
    expect(bodyOf("2019 Audi A4 Sedan Sport 2.0 TFSI Quattro (1)", "Audi A4")).toBe("sedan");
    expect(bodyOf("Dacia Logan 1.4 mpi", "Dacia Logan")).toBeUndefined();
    expect(bodyOf("1975 Volkswagen Kombi", "Volkswagen Kombi")).toBeUndefined();
    expect(versionBody("LOGAN Zen Flex 1.0 12V 4p Mec.")).toBeUndefined();
    expect(versionBody("A4 Avant Ambiente 2.0 TFSI")).toBe("perua");
    expect(versionBody("STRADA Freedom 1.3 Flex 8V CD")).toBe("picape");
  });

  it("shows a version the photos of its body style", () => {
    const photo = (name: string, body?: AppPhoto["body"]): AppPhoto => ({
      thumb: name,
      page: name,
      angle: "frente",
      from: 2020,
      to: 2027,
      ...(body && { body }),
    });
    const photos = [photo("a"), photo("b", "sedan"), photo("c"), photo("d", "perua"), photo("e", "picape")];
    expect(photosOfBody(photos, "LOGAN Zen Flex 1.0 12V 4p Mec.").map((item) => item.thumb)).toEqual(["a", "b", "c"]);
    expect(photosOfBody(photos, "A4 Avant Ambiente").map((item) => item.thumb)).toEqual(["a", "c", "d"]);
    // Too few left: all of them.
    expect(photosOfBody(photos.slice(3), "Logan Zen")).toHaveLength(2);
  });

  it("puts a photo in the generation its name codes, before its year", () => {
    expect(generationCodes("fifth generation b9 8w", "Audi A4")).toEqual(["b9"]);
    expect(generationCodes("logan iii renault taliant", "Dacia Logan")).toEqual(["iii"]);
    const generations = [
      { file: "a.jpg", from: 2008, to: 2016, names: "fourth generation b8 8k" },
      { file: "b.jpg", from: 2015, to: 2025, names: "fifth generation b9 8w" },
    ];
    const gallery = pickGallery([file("2015 Audi A4 B9 2.0 TFSI front.jpg"), file("2015 Audi A4 Avant front.jpg")], {
      label: "Audi A4",
      generations,
      now,
    });
    expect(gallery.map((photo) => `${photo.from}-${photo.to} ${photo.body ?? "-"} ${photo.file}`)).toEqual([
      "2015-2025 - 2015 Audi A4 B9 2.0 TFSI front.jpg",
      "2008-2016 perua 2015 Audi A4 Avant front.jpg",
    ]);
  });

  it("ends a generation without an end when the next one starts", () => {
    const generations = [
      { file: "a.jpg", from: 2004, to: null },
      { file: "b.jpg", from: 2012, to: null },
    ];
    const gallery = pickGallery([file("2009 Dacia Logan.jpg"), file("2017 Dacia Logan.jpg")], {
      label: "Dacia Logan",
      generations,
      now,
    });
    expect(gallery.map((photo) => `${photo.from}-${photo.to}`)).toEqual(["2004-2012", "2012-2027"]);
  });
});
