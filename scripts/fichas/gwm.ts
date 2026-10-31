// GWM's spec pages (gwmmotors.com.br/pt/modelos/<modelo>/specification, npm
// run fichas:sites): a version each, with no year. The figures as "<b>Motor:</b>
// 2.4 Turbo Diesel" lines; the equipment under group headings ("Conforto",
// "Segurança"), as lines of text (the Haval H9's) or a list whose items are a
// name and a description ("<b>Teto Panorâmico:</b> Amplitude…"). The pages do
// not say which FIPE version they are, so each is named here by hand; the
// model numbers go in the trims ("Ora 05"), since a line's words leave numbers out.

import type { EquipmentList } from "./equipment.ts";
import { htmlText } from "./html.ts";
import type { SitePage } from "./kia.ts";
import { litersOf, specsOfFields } from "./open-sheets.ts";
import type { OpenSheet } from "./open-sheets.ts";

export interface GwmPage {
  /** The path's last part: "haval-h9-selection". */
  slug: string;
  line: string;
  trims: string[];
  hybrid?: boolean;
  electric?: boolean;
  diesel?: boolean;
}

/** The pages that read as a spec sheet, as FIPE names their versions (the Haval H6 and Poer pages are missing, the Ora 03's say no trim, FIPE has no Haval H7 yet). */
export const gwmPages: GwmPage[] = [
  { slug: "haval-h9", line: "Haval H9", trims: ["exclusive"], diesel: true },
  { slug: "haval-h9-selection", line: "Haval H9", trims: ["selection"], diesel: true },
  { slug: "tank-300", line: "Tank", trims: ["300"], hybrid: true },
  { slug: "tank-300-terra-force", line: "Tank", trims: ["300", "terraforce"], hybrid: true },
  { slug: "wey-07", line: "Wey", trims: ["07"], hybrid: true },
  { slug: "wey-07-dark-edition", line: "Wey", trims: ["07", "dark", "edition"], hybrid: true },
  { slug: "ora5", line: "Ora", trims: ["05"], electric: true },
];

const equipmentGroup = /conforto|seguran|conectividade|tecnologia|vidros|ilumina|exterior|interior|design|multim/i;

/** The sheet and the equipment list of a spec page. */
export function gwmSpecPage(html: string, page: GwmPage, source: SitePage): { sheet?: OpenSheet; list?: EquipmentList } {
  const fields: { label: string; text: string }[] = [];
  const groups: { name: string; items: string[] }[] = [];
  let group: string | undefined;
  const add = (item: string) => {
    const name = item.replace(/:$/, "").trim();
    if (!group || !equipmentGroup.test(group) || !name) return;
    const of = groups.find((other) => other.name === group) ?? groups[groups.push({ name: group, items: [] }) - 1]!;
    if (!of.items.includes(name)) of.items.push(name);
  };
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "");
  // In the page's order: group headings, text paragraphs and list items.
  const pieces =
    /class="(?:content-title|head)[^"]*">([^<]+)<|class="title-bar">\s*<p[^>]*>([^<]+)<|<p class="text[^"]*">([\s\S]*?)<\/p>|<li class="disc">([\s\S]*?)<\/li>/g;
  for (const [, title, popupTitle, paragraph, listItem] of body.matchAll(pieces)) {
    if (title ?? popupTitle) {
      group = htmlText(title ?? popupTitle!);
      continue;
    }
    for (const line of (paragraph ?? listItem!).split(/<br\s*\/?>/i)) {
      // "<b>Motor:</b> 2.4", "<b>Motor</b>: 2.4": a field in the figures, an item's name in the equipment.
      const bold = line.match(/^\s*<b>([\s\S]*?)<\/b>\s*:?\s*([\s\S]*)$/);
      const label = bold && htmlText(bold[1]!).replace(/\s*:$/, "");
      if (label && (!group || !equipmentGroup.test(group))) fields.push({ label, text: htmlText(bold![2]!) });
      else add(label ?? htmlText(line));
    }
  }
  const engine = fields.find(({ label }) => /^motor$/i.test(label))?.text ?? "";
  const engineLiters = page.electric ? undefined : litersOf(engine);
  const year = Number(source.fetched.slice(0, 4));
  // Not the turbo nor the gearbox: FIPE leaves them out ("Tank 300 2.0 16V AWD Aut.", "Haval H9 Exclusive TD480").
  const key = {
    brand: "gwm" as const,
    line: page.line,
    trims: page.trims,
    years: [year, year + 1] as [number, number],
    ...(engineLiters !== undefined && { engineLiters }),
    electric: Boolean(page.electric),
    ...(page.hybrid && { hybrid: true }),
    ...(page.diesel !== undefined && { diesel: page.diesel }),
    // A line's other versions name more trims: only those naming this one's.
    onlyNamed: true,
  };
  const title = `${page.line} · ${page.trims.map((trim) => trim.charAt(0).toUpperCase() + trim.slice(1)).join(" ")}`;
  // "88-1598L", "239 L /1.040 L (3º fileira com bancos rebatidos)": the first, with every seat up.
  const specs = specsOfFields(
    fields.map(({ label, text }) => ({ label, text: /porta.?mala/i.test(label) ? (text.match(/^[\d.,]+/)?.[0] ?? "") : text })),
  );
  return {
    ...(Object.keys(specs).length && { sheet: { ...key, title, page: source.url, url: source.url, file: source.file, specs } }),
    ...(groups.length && { list: { ...key, title, page: source.url, file: source.file, groups } }),
  };
}
