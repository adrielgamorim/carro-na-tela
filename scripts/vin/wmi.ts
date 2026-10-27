// Reads the WMI (world manufacturer identifier) list and the country code
// ranges from the wikitext of the English Wikipedia article "Vehicle
// identification number", and matches each manufacturer to FIPE brands by
// name. NHTSA's vPIC knows few Brazilian WMIs (9BG, 9BD, 93H… are missing),
// hence this list.

import { brandNames } from "../wikidata/match.ts";

export interface WmiRow {
  codes: string[];
  country: string | null;
  maker: string;
}

/** Wiki markup → plain text: links keep their label; refs and templates go. */
export function cleanWikiText(text: string): string {
  return text
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function section(wikitext: string, start: string, end: string): string {
  const from = wikitext.indexOf(start);
  const to = wikitext.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Seção "${start}" não encontrada no artigo`);
  return wikitext.slice(from, to);
}

/**
 * Rows "| WMI || country || maker", where the country cell may span the next
 * rows ("rowspan=N| Brazil") and then is left out of them.
 */
export function parseWmiRows(wikitext: string): WmiRow[] {
  const rows: WmiRow[] = [];
  let country: string | null = null;
  let spanLeft = 0;
  for (const line of section(wikitext, "==List of common WMI==", "==See also==").split("\n")) {
    if (!line.startsWith("|") || !line.includes("||")) continue;
    const cells = line.slice(1).split("||");
    const codes = (cells[0] ?? "").trim().split(/[\s,/]+/).filter((code) => /^[A-Z0-9]{2,3}$/.test(code));
    if (!codes.length) continue;

    let maker: string;
    if (cells.length >= 3) {
      const span = /^\s*row\s*span\s*=\s*["“”]?(\d+)["“”]?\s*\|(.*)$/i.exec(cells[1] ?? "");
      country = cleanWikiText((span ? span[2] : cells[1]) ?? "") || null;
      spanLeft = span ? Number(span[1]) - 1 : 0;
      maker = cells.slice(2).join("||");
    } else {
      if (spanLeft > 0) spanLeft--;
      else country = null;
      maker = cells[1] ?? "";
    }
    rows.push({ codes, country, maker: cleanWikiText(maker) });
  }
  return rows;
}

/** "'''AA-AH''' South Africa<br />" → ["AA", "AH", "South Africa"] */
export function parseCountryRanges(wikitext: string): [string, string, string][] {
  const text = section(wikitext, "====Country or region codes====", "===Vehicle descriptor section===");
  const ranges: [string, string, string][] = [];
  const pattern = /'''([A-Z0-9]{2})(?:\s*[-–]\s*([A-Z0-9]{2}))?'''\s*([^<\n]+)/g;
  for (const [, from, to, country] of text.matchAll(pattern)) {
    if (!from || !country) continue;
    const name = cleanWikiText(country);
    if (name) ranges.push([from, to ?? from, name]);
  }
  return ranges;
}

function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

// FIPE brands whose names are common words or too short to find in prose.
const ambiguousBrands = new Set(["Baby", "Walk", "Wake", "FEVER", "TAC", "RELY", "Fyber", "BRM", "JPX"]);
// Used only when no brand name appears ("General Motors South Africa").
const fallbackNames: Record<string, string[]> = {
  "GM - Chevrolet": ["General Motors"],
};

const heavyVehicles =
  /\b(trucks?|bus(es)?|motorcycles?|motos|motorrad|scooters?|motorscooters|two wheelers|tractors?|trailers?|chassis|caminh[õo]es|ônibus)\b/i;
const lightVehicles = /\b(cars?|SUVs?|pickups?|vans?|MPV)\b/i;

/**
 * Finds the FIPE brands a maker description names. The first brand in the
 * text wins ("Renault Sandero made by Nissan" is a Renault); brands that share
 * that name all count (Chery → "Caoa Chery" and "Caoa Chery/Chery").
 */
export function createBrandMatcher(fipeBrands: string[]) {
  const primary = new Map<string, string[]>();
  const fallback = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, name: string, brand: string) => {
    const key = words(name).join(" ");
    if (key) map.set(key, [...new Set([...(map.get(key) ?? []), brand])]);
  };
  for (const brand of fipeBrands) {
    if (ambiguousBrands.has(brand)) continue;
    for (const name of brandNames[brand] ?? [brand]) add(primary, name, brand);
    for (const name of fallbackNames[brand] ?? []) add(fallback, name, brand);
  }

  function find(map: Map<string, string[]>, text: string[]): string[] {
    let best: { at: number; length: number; brands: string[] } | null = null;
    for (const [key, brands] of map) {
      const name = key.split(" ");
      for (let at = 0; at + name.length <= text.length; at++) {
        if (best && (at > best.at || (at === best.at && name.length <= best.length))) break;
        if (name.every((word, offset) => text[at + offset] === word)) {
          best = { at, length: name.length, brands };
          break;
        }
      }
    }
    return best?.brands ?? [];
  }

  return (maker: string): string[] => {
    // The catalog has cars only: Honda motorcycles or Volvo trucks are not a
    // Honda or Volvo car.
    if (heavyVehicles.test(maker) && !lightVehicles.test(maker)) return [];
    const text = words(maker);
    const found = find(primary, text);
    return found.length ? found : find(fallback, text);
  };
}
