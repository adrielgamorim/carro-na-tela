import { describe, expect, it } from "vitest";
import { listingLinks, searchBrand } from "./listings";

describe("listingLinks", () => {
  it("searches a car's line, by its year where the site filters by it", () => {
    expect(listingLinks({ brand: "GM - Chevrolet", family: "Onix", category: "cars", modelYear: 2022 })).toEqual([
      { site: "Webmotors", url: "https://www.webmotors.com.br/carros/estoque/chevrolet/onix/de.2022/ate.2022" },
      { site: "OLX", url: "https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios?q=Chevrolet%20Onix" },
      { site: "Mercado Livre", url: "https://lista.mercadolivre.com.br/veiculos/chevrolet-onix-2022" },
    ]);
  });

  it("leaves the year out for 0 km, and Webmotors out for trucks", () => {
    const zeroKm = listingLinks({ brand: "Citroën", family: "C4 Cactus", category: "cars", modelYear: 32000 });
    expect(zeroKm[0]!.url).toBe("https://www.webmotors.com.br/carros/estoque/citroen/c4-cactus");
    const truck = listingLinks({ brand: "VW - VolksWagen", family: "Constellation", category: "trucks", modelYear: 2020 });
    expect(truck.map((link) => link.site)).toEqual(["OLX", "Mercado Livre"]);
    expect(truck[0]!.url).toBe("https://www.olx.com.br/autos-e-pecas/caminhoes?q=Volkswagen%20Constellation");
  });

  it("names the brand as people search it", () => {
    expect(searchBrand("GM - Chevrolet")).toBe("Chevrolet");
    expect(searchBrand("VW - VolksWagen")).toBe("Volkswagen");
    expect(searchBrand("Honda")).toBe("Honda");
  });
});
