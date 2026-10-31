// Ford's version pages (ford.com.br/<categoria>/<modelo>/compare-as-versoes/<versão>.html,
// npm run fichas:sites): a version each, its title with the model year
// ("XLS 2.0 Diesel 4x4 AT 2027") or none (the F-150's, the Transit's). Groups
// of two-column rows ("Potência | 170 cv @ 3.500 rpm"), under a heading each:
// the figures in "PERFORMANCE", "MOTOR E TRANSMISSÃO", "DIMENSÕES" or "ESPECIFICAÇÕES TÉCNICAS", the
// equipment in the others, an empty second column for an item it has. The
// pages do not say which FIPE version they are, so each is named here by hand.

import type { EquipmentList } from "./equipment.ts";
import { htmlText } from "./html.ts";
import type { SitePage } from "./kia.ts";
import { litersOf, specsOfFields } from "./open-sheets.ts";
import type { OpenSheet, Transmission } from "./open-sheets.ts";

export interface FordPage {
  /** The path from the category on, without ".html": "ranger/compare-as-versoes/xlt-30-diesel-4wd-at". */
  path: string;
  category: string;
  line: string;
  trims: string[];
  /** None for a line with one gearbox, whose FIPE names say none ("F-150 Lariat 4x4 5.0 V8"). */
  transmission?: Transmission;
  diesel?: boolean;
  electric?: boolean;
}

const page = (category: string, path: string, line: string, trims: string[], transmission: Transmission | undefined, fuel: "diesel" | "gasolina" | "eletrico") => ({
  category,
  path,
  line,
  trims,
  ...(transmission && { transmission }),
  ...(fuel === "eletrico" ? { electric: true } : { diesel: fuel === "diesel" }),
});

/**
 * The pages as FIPE names their versions: the Transit's 14+1 and 17+1 are its
 * "15 Lug." and "18 Lug.", "Médio" and "Longo" its L2H3 and L3H3. Of the
 * versions FIPE has one name for, the first: the Longo's 350L (not the 380L
 * and 400L), the Vidrada's 410L L3H2 (not the 440E L4H3). The Ranger XL pages
 * have no rows; the Maverick, Territory, Bronco Sport and Mustang have no page.
 */
export const fordPages: FordPage[] = [
  page("picapes", "ranger/compare-as-versoes/black-2-0-diesel-4x2-at", "Ranger", ["black"], "automatico", "diesel"),
  page("picapes", "ranger/compare-as-versoes/xls-2-0-diesel-4x4-at", "Ranger", ["xls"], "automatico", "diesel"),
  page("picapes", "ranger/compare-as-versoes/xls-3-0-diesel-4wd-at", "Ranger", ["xls"], "automatico", "diesel"),
  page("picapes", "ranger/compare-as-versoes/xlt-30-diesel-4wd-at", "Ranger", ["xlt"], "automatico", "diesel"),
  page("picapes", "ranger/compare-as-versoes/limited-30-diesel-4wd-at-kit-opcional", "Ranger", ["limited"], "automatico", "diesel"),
  page("picapes", "f-150/compare-as-versoes/lariat", "F-150", ["lariat"], undefined, "gasolina"),
  page("picapes", "f-150/compare-as-versoes/lariat-black", "F-150", ["lariat", "black"], undefined, "gasolina"),
  page("veiculos-comerciais", "transit-furgao/compare-as-versoes/furgao-l2h3", "Transit Furgão", ["medio"], "manual", "diesel"),
  page("veiculos-comerciais", "transit-furgao/compare-as-versoes/furgao-l2h3-at", "Transit Furgão", ["medio"], "automatico", "diesel"),
  page("veiculos-comerciais", "transit-furgao/compare-as-versoes/furgao-l3h3", "Transit Furgão", ["longo"], "manual", "diesel"),
  page("veiculos-comerciais", "transit-furgao/compare-as-versoes/furgao-l3h3-at", "Transit Furgão", ["longo"], "automatico", "diesel"),
  page("veiculos-comerciais", "transit-chassi/compare-as-versoes/350e-mt", "Transit Chassi", ["350e"], "manual", "diesel"),
  page("veiculos-comerciais", "transit-chassi/compare-as-versoes/470e-mt", "Transit Chassi", ["470e"], "manual", "diesel"),
  page("veiculos-comerciais", "transit-minibus/compare-as-versoes/minibus-14", "Transit Minibus", ["15"], "manual", "diesel"),
  page("veiculos-comerciais", "transit-minibus/compare-as-versoes/minibus-14-at", "Transit Minibus", ["15"], "automatico", "diesel"),
  page("veiculos-comerciais", "transit-minibus/compare-as-versoes/minibus-17", "Transit Minibus", ["18"], "manual", "diesel"),
  page("veiculos-comerciais", "transit-minibus/compare-as-versoes/minibus-17-at", "Transit Minibus", ["18"], "automatico", "diesel"),
  page("veiculos-comerciais", "transit-minibus/compare-as-versoes/minibus-vidrada", "Transit Minibus", ["vidrada"], "manual", "diesel"),
  page("veiculos-comerciais", "transit-minibus/compare-as-versoes/minibus-vidrada-at", "Transit Minibus", ["vidrada"], "automatico", "diesel"),
  page("veiculos-comerciais", "e-transit-furgao/compare-as-versoes/furgao-12-4-m3", "E-Transit Furgão", ["longo"], undefined, "eletrico"),
];

const figureGroup = /perform|dimens|especifica|^motor/i;

/** The sheet and the equipment list of a version page. */
export function fordSpecPage(html: string, page: FordPage, source: SitePage): { sheet?: OpenSheet; list?: EquipmentList } {
  const fields: { label: string; text: string }[] = [];
  const groups: { name: string; items: string[] }[] = [];
  let group = "";
  const pieces =
    /<div class="accordion-title[^"]*">\s*<a[^>]*>\s*<h3>([\s\S]*?)<\/h3>|<tr>\s*<td class="title">([\s\S]*?)<\/td>\s*<td class="data">([\s\S]*?)<\/td>/g;
  for (const [, heading, label, value] of html.matchAll(pieces)) {
    if (heading !== undefined) {
      const text = htmlText(heading);
      group = text.charAt(0) + text.slice(1).toLowerCase();
      continue;
    }
    const name = htmlText(label!);
    const text = htmlText(value!);
    if (!name || !group) continue;
    if (figureGroup.test(group)) {
      fields.push({ label: name, text });
      continue;
    }
    const of = groups.find((other) => other.name === group) ?? groups[groups.push({ name: group, items: [] }) - 1]!;
    // The Ranger Limited's kit is what FIPE's "Limited+" has, and the Limited's option.
    const item = `${text ? `${name}: ${text}` : name}${/opcional/i.test(group) ? " (opcional)" : ""}`;
    if (!of.items.includes(item)) of.items.push(item);
  }
  // "Motor = 2.0 turbo Diesel", or the label alone ("Motor Coyote 5.0L V8").
  const engine = fields.filter(({ label }) => /^motor/i.test(label)).map(({ label, text }) => `${label} ${text}`).join(" ");
  const engineLiters = page.electric ? undefined : litersOf(engine);
  const titleYear = Number(html.match(/<title>[^<]*\b(20\d\d)\b/)?.[1]);
  const year = Number(source.fetched.slice(0, 4));
  // "2027" in October 2026 is this year's 0 km too.
  const years: [number, number] = titleYear ? [titleYear - 1, titleYear] : [year, year + 1];
  // Not the turbo: FIPE writes it for some ("TB") and not others ("Transit Chassi 350E 2.0 EcoBlue Diesel").
  const key = {
    brand: "ford" as const,
    line: page.line,
    trims: page.trims,
    years,
    ...(engineLiters !== undefined && { engineLiters }),
    electric: Boolean(page.electric),
    ...(page.diesel !== undefined && { diesel: page.diesel }),
    ...(page.transmission && { transmission: page.transmission }),
    // A line's other versions name more trims: only those naming this one's.
    onlyNamed: true,
  };
  const name = htmlText(html.match(/<title>([^<|]*)/)?.[1] ?? "").replace(/\s*\b20\d\d\b.*$/, "");
  const title = `${page.line} · ${name.replace(new RegExp(`^(picape )?${page.line}\\s*`, "i"), "") || page.trims.join(" ")}`;
  const specs = specsOfFields(
    fields
      // The width with the mirrors is not the car's; Ford calls the fuel tank a "reservatório".
      .filter(({ label }) => !/com espelho/i.test(label))
      .map(({ label, text }) => ({ label: label.replace(/^reservat[óo]rio de combust[íi]vel/i, "Tanque de combustível"), text })),
  );
  return {
    ...(Object.keys(specs).length && { sheet: { ...key, title, page: source.url, url: source.url, file: source.file, specs } }),
    ...(groups.length && { list: { ...key, title, page: source.url, file: source.file, groups } }),
  };
}
