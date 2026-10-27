import { describe, expect, it } from "vitest";
import { findFallback, titleFits } from "./fallback.ts";

describe("titleFits", () => {
  it("needs the brand and the line's telling word", () => {
    expect(titleFits("Fiat Punto", "Fiat", "Punto")).toBe(true);
    expect(titleFits("Fiat Siena", "Fiat", "Grand Siena")).toBe(true);
    expect(titleFits("Volkswagen Gol", "VW - VolksWagen", "Gol")).toBe(true);
    expect(titleFits("Citroen Basalt Turbo 200 Shine 2025.jpg", "Citroën", "BASALT")).toBe(true);
    // The search drifts to another model, or finds the brand inside a word.
    expect(titleFits("JAC Refine S2", "JAC", "T40")).toBe(false);
    expect(titleFits("Brampton Classic", "RAM", "Classic")).toBe(false);
    expect(titleFits("Fiat Uno", "Fiat", "Punto")).toBe(false);
  });
});

/** Fake Wikimedia APIs: search hits, summaries and file credits by URL. */
function fakeApis(pages: { pt?: string[]; en?: string[]; commons?: string[]; summaryImage?: string }) {
  const urls: string[] = [];
  const getJson = async <T,>(url: string): Promise<T> => {
    urls.push(url);
    const host = new URL(url).hostname;
    const params = new URL(url).searchParams;
    if (url.includes("/page/summary/")) {
      const title = decodeURIComponent(url.split("/page/summary/")[1] ?? "").replace(/_/g, " ");
      return {
        type: "standard",
        title,
        extract: `O ${title} é um automóvel. Foi vendido no Brasil.`,
        originalimage: { source: `https://upload.wikimedia.org/x/${pages.summaryImage ?? "Car.jpg"}` },
        content_urls: { desktop: { page: `https://${host}/wiki/${title}` } },
      } as T;
    }
    if (params.get("prop") === "imageinfo") {
      return {
        query: {
          pages: [
            {
              imageinfo: [
                {
                  thumburl: "https://upload.wikimedia.org/thumb.jpg",
                  extmetadata: { Artist: { value: "<a>Fulano</a>" }, LicenseShortName: { value: "CC BY-SA 4.0" } },
                },
              ],
            },
          ],
        },
      } as T;
    }
    const hits = host.startsWith("pt.") ? pages.pt : host.startsWith("en.") ? pages.en : pages.commons;
    return { query: { search: (hits ?? []).map((title) => ({ title })) } } as T;
  };
  return { getJson, urls };
}

describe("findFallback", () => {
  it("takes the Portuguese article, with its picture credited", async () => {
    const { getJson } = fakeApis({ pt: ["Fiat Uno", "Fiat Punto"] });
    expect(await findFallback(getJson, "Fiat", "Punto")).toEqual({
      id: "wikipedia:pt:Fiat Punto",
      label: "Fiat Punto",
      description: "O Fiat Punto é um automóvel. Foi vendido no Brasil.",
      wikipedia: "https://pt.wikipedia.org/wiki/Fiat Punto",
      image: {
        thumb: "https://upload.wikimedia.org/thumb.jpg",
        page: "https://commons.wikimedia.org/wiki/File:Car.jpg",
        artist: "Fulano",
        license: "CC BY-SA 4.0",
      },
    });
  });

  it("falls back to English (picture only), then to Commons", async () => {
    const english = await findFallback(fakeApis({ en: ["Iveco Daily"] }).getJson, "IVECO", "DAILY");
    expect(english).toMatchObject({ id: "wikipedia:en:Iveco Daily", wikipedia: "https://en.wikipedia.org/wiki/Iveco Daily" });
    expect(english?.description).toBeUndefined();

    const commons = await findFallback(
      fakeApis({ commons: ["File:Logo Citroen.svg", "File:Citroen Basalt Shine 2025.jpg"] }).getJson,
      "Citroën",
      "BASALT",
    );
    expect(commons).toMatchObject({
      id: "commons:Citroen Basalt Shine 2025.jpg",
      label: "Citroën BASALT",
      image: { page: "https://commons.wikimedia.org/wiki/File:Citroen_Basalt_Shine_2025.jpg" },
    });
  });

  it("gives nothing when no title fits, or the article has only a logo", async () => {
    expect(await findFallback(fakeApis({ pt: ["JAC Refine S2"], commons: ["File:JAC Refine S2.jpg"] }).getJson, "JAC", "T40")).toBeNull();
    expect(await findFallback(fakeApis({ pt: ["Fiat Punto"], summaryImage: "Fiat logo.svg" }).getJson, "Fiat", "Punto")).toBeNull();
  });
});

describe("stricter fallback rules", () => {
  it("reads the file name of thumbnail URLs", async () => {
    const { commonsFileOf } = await import("./fallback.ts");
    expect(
      commonsFileOf(
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/2006_Fiat_Grande_Punto.jpg/3840px-2006_Fiat_Grande_Punto.jpg?utm_source=pt.wikipedia.org",
      ),
    ).toBe("2006_Fiat_Grande_Punto.jpg");
    expect(commonsFileOf("https://upload.wikimedia.org/wikipedia/commons/e/e2/Car%20front.jpg")).toBe("Car front.jpg");
  });

  it("refuses one-letter lines, generic words and brands that are common words", async () => {
    expect(titleFits("4 cilindros y museo BMW", "BMW", "M")).toBe(false);
    expect(titleFits("MG 4 X-Power", "MG", "4")).toBe(true);
    expect(titleFits("Mahindra XUV SUV", "Mahindra", "SUV")).toBe(false);
    const { getJson, urls } = fakeApis({ commons: ["File:Ebbesbourne Wake, The Cross.jpg"] });
    expect(await findFallback(getJson, "Wake", "Cross")).toBeNull();
    expect(await findFallback(getJson, "SERES", "SERES")).toBeNull();
    expect(urls).toEqual([]);
  });
});

describe("RAM on Commons", () => {
  it("uses Wikipedia for RAM but not Commons", async () => {
    const { getJson } = fakeApis({ commons: ["File:Amulet of a walking ram MET 17.194.2500.jpg"] });
    expect(await findFallback(getJson, "RAM", "2500")).toBeNull();
    expect((await findFallback(fakeApis({ en: ["Ram 1500"] }).getJson, "RAM", "1500"))?.id).toBe("wikipedia:en:Ram 1500");
  });
});

describe("hand-picked sources", () => {
  it("fetches the chosen article or file instead of searching", async () => {
    const titles = [
      { brand: "GM - Chevrolet", family: "Zafira", source: "pt:Opel Zafira" },
      { brand: "NETA", family: "X", source: "commons:Neta X 002.jpg" },
    ];
    const article = await findFallback(fakeApis({}).getJson, "GM - Chevrolet", "Zafira", titles);
    expect(article).toMatchObject({ id: "wikipedia:pt:Opel Zafira", label: "Opel Zafira" });
    const { getJson, urls } = fakeApis({});
    const file = await findFallback(getJson, "NETA", "X", titles);
    expect(file).toMatchObject({ id: "commons:Neta X 002.jpg", label: "NETA X" });
    expect(urls.some((url) => url.includes("list=search"))).toBe(false);
  });
});

describe("fallbackFitsModel", () => {
  it("lends the line's picture only to a model it names", async () => {
    const { fallbackFitsModel } = await import("./fallback.ts");
    expect(fallbackFitsModel("Toyota Hilux", "Toyota Hilux SW4", "Toyota")).toBe(true);
    expect(fallbackFitsModel("Porsche 911", "Porsche 911 Targa", "Porsche")).toBe(true);
    expect(fallbackFitsModel("BYD Song Plus", "BYD Song Pro", "BYD")).toBe(true);
    expect(fallbackFitsModel("Volvo XC90", "Volvo EX40", "Volvo")).toBe(false);
    expect(fallbackFitsModel("Opel Zafira", "Chevrolet Zafira", "GM - Chevrolet")).toBe(true);
  });
});
