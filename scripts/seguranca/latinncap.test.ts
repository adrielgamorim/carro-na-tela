import { describe, expect, it } from "vitest";
import { crashTestOfVersion, crashTests, testedModels } from "./latinncap.ts";
import type { CrashTest } from "./latinncap.ts";

// Two cards of the results page, as the site writes them.
const html = `
<a class="resultado-card resultado-card--historico test--2016" href="en/result/102/volkswagen-virtus-+-4-airbags">
  <h3 class="resultado-titulo">Volkswagen Virtus + 4 Airbags</h3>
  <p class="resultado-test"> TEST <strong>2018</strong> </p>
  <div class="resultado-calificacion calificacion-adulto"><img class="resultado-calificacion-estrellas" src="assets/img/ico-5-estrellas.svg" alt="5 stars"></div>
  <div class="resultado-calificacion calificacion-nino"><img class="resultado-calificacion-estrellas" src="assets/img/test-viejo/4_estrellas_nino.svg" alt="4 stars"></div>
  <footer><img src="data/marcas/volkswagen.svg" class="resultado-marca-logo" alt="Volkswagen"></footer>
</a>
<a class="resultado-card test--2020" href="en/result/180/chevrolet-new-onix-plus">
  <h3 class="resultado-titulo">Chevrolet New Onix Plus + 6 Airbags</h3>
  <div class="resultado-estrellas"> <img src="assets/img/ico-5-estrellas.svg" alt="5 estrellas"> </div>
  <p class="resultado-test">TEST <strong>2023</strong></p>
  <span class="dato-valor valor-adulto">85 %</span><span class="dato-valor valor-nino">88 %</span>
  <span class="dato-valor valor-vulnerables">58 %</span><span class="dato-valor valor-asistentes">71 %</span>
  <footer><img src="data/marcas/chevrolet.svg" class="resultado-marca-logo" alt="Chevrolet"></footer>
</a>`;

const test = (fields: Partial<CrashTest>): CrashTest => ({
  id: 1,
  title: "",
  brand: "Chevrolet",
  year: 2019,
  protocol: 2016,
  url: "",
  ...fields,
});

describe("Latin NCAP", () => {
  it("reads the old protocol's two ratings and the current one's rating and scores", () => {
    expect(crashTests(html)).toEqual([
      {
        id: 102,
        title: "Volkswagen Virtus + 4 Airbags",
        brand: "Volkswagen",
        year: 2018,
        protocol: 2016,
        adultStars: 5,
        childStars: 4,
        url: "https://www.latinncap.com/en/result/102/volkswagen-virtus-+-4-airbags",
      },
      {
        id: 180,
        title: "Chevrolet New Onix Plus + 6 Airbags",
        brand: "Chevrolet",
        year: 2023,
        protocol: 2020,
        stars: 5,
        scores: [85, 88, 58, 71],
        url: "https://www.latinncap.com/en/result/180/chevrolet-new-onix-plus",
      },
    ]);
  });

  it("names the models a title covers, without brand, airbags or VIN", () => {
    expect(testedModels({ title: "Renault Sandero / Logan + 2 Airbags", brand: "Renault" })).toEqual(["Sandero", "Logan"]);
    expect(testedModels({ title: "Ford KA Fly Viral - NO Airbags", brand: "Ford" })).toEqual(["KA Fly Viral"]);
    expect(
      testedModels({ title: "Chery - Chirey Tiggo 2 / Tiggo 2 Pro + 4 Airbags", brand: "Chery / Chirey" }),
    ).toEqual(["Tiggo 2", "Tiggo 2 Pro"]);
  });

  it("gives a version its line's test of that time, the most specific name first", () => {
    const tests = [
      test({ id: 1, title: "Chevrolet Onix + 2 Airbags", year: 2017, adultStars: 0, childStars: 3 }),
      test({ id: 2, title: "Chevrolet New Onix Plus + 6 Airbags", year: 2019, adultStars: 5, childStars: 5 }),
      test({ id: 3, title: "Chevrolet New Onix Hatchback + 6 Airbags", year: 2019, adultStars: 5, childStars: 5 }),
    ];
    const of = (name: string, modelYear: number) =>
      crashTestOfVersion(tests, { brand: "GM - Chevrolet", family: "ONIX", name, modelYear })?.id;
    expect(of("ONIX PLUS LT 1.0 Turbo Flex Aut.", 2021)).toBe(2);
    expect(of("ONIX HATCH LT 1.0 12V Flex 5p Mec.", 2021)).toBe(3);
    expect(of("ONIX HATCH LT 1.0 12V Flex 5p Mec.", 2018)).toBe(1);
    // Older than a year before the test, or more than five after: none.
    expect(of("ONIX HATCH LT 1.0 12V Flex 5p Mec.", 2015)).toBeUndefined();
    expect(of("ONIX HATCH LT 1.0 12V Flex 5p Mec.", 2026)).toBeUndefined();
  });
});
