// Links to search a catalog line on the classifieds sites, already filled
// in: "Chevrolet Onix" (and the model year, where the site filters by it).
// iCarros is left out: its classifieds search is off since nov/2026. Each
// site's favicon is in public/listings (Facebook takes the visitor to their
// own city's Marketplace).

import type { CatalogEntry } from "./types";
import { zeroKmModelYear } from "../services/fipeParsing";

export interface ListingLink {
  site: string;
  url: string;
  /** The site's favicon, under public/. */
  icon: string;
}

/** "GM - Chevrolet" → "Chevrolet", "VW - VolksWagen" → "Volkswagen". */
export function searchBrand(brand: string): string {
  const name = brand.replace(/^(GM|VW)\s*-\s*/i, "");
  return /^volkswagen$/i.test(name) ? "Volkswagen" : name;
}

/** "Mercedes-Benz" → "mercedes-benz", "Citroën C4 Cactus" → "citroen-c4-cactus". */
const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const olxCategories = { cars: "carros-vans-e-utilitarios", motorcycles: "motos", trucks: "caminhoes" } as const;
const webmotorsCategories = { cars: "carros", motorcycles: "motos" } as const;

export function listingLinks(entry: Pick<CatalogEntry, "brand" | "family" | "category" | "modelYear">): ListingLink[] {
  const brand = searchBrand(entry.brand);
  const query = `${brand} ${entry.family}`;
  const year = entry.modelYear !== null && entry.modelYear !== zeroKmModelYear ? entry.modelYear : null;
  const links: ListingLink[] = [];
  // Webmotors has no truck section.
  if (entry.category !== "trucks") {
    const section = webmotorsCategories[entry.category];
    links.push({
      site: "Webmotors",
      icon: "listings/webmotors.png",
      url: `https://www.webmotors.com.br/${section}/estoque/${slug(brand)}/${slug(entry.family)}${year ? `/de.${year}/ate.${year}` : ""}`,
    });
  }
  links.push({
    site: "OLX",
    icon: "listings/olx.ico",
    url: `https://www.olx.com.br/autos-e-pecas/${olxCategories[entry.category]}?q=${encodeURIComponent(query)}`,
  });
  links.push({
    site: "Mercado Livre",
    icon: "listings/mercadolivre.ico",
    url: `https://lista.mercadolivre.com.br/veiculos/${slug(`${query}${year ? ` ${year}` : ""}`)}`,
  });
  // The general search: the Vehicles category page ignores the query.
  const marketplace = new URLSearchParams({ query });
  if (year) {
    marketplace.set("minYear", String(year));
    marketplace.set("maxYear", String(year));
  }
  links.push({
    site: "Facebook Marketplace",
    icon: "listings/facebook.ico",
    url: `https://www.facebook.com/marketplace/search/?${marketplace}`,
  });
  return links;
}
