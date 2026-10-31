// Kia's spec pages (kia.com.br/<modelo>/especificacoes, npm run fichas:sites):
// "Itens de Série", a table per group ("Conforto & Conveniência") with a
// column per version code ("N.855": "●" or "-"); and the "Ficha Técnica", a
// hidden table of item, value and version-year code ("N.855.2627": model
// years 26 and 27), with a few more rows in a table by code ("Outras
// especificações"). The model's page names each code ("Niro HEV EX").

import type { EquipmentList } from "./equipment.ts";
import { withUnit } from "./honda.ts";
import { attribute, htmlRows, htmlText } from "./html.ts";
import { litersOf, plain, specsOfFields, transmissionIn, turboIn, words } from "./open-sheets.ts";
import type { OpenSheet } from "./open-sheets.ts";

/** The models kia.com.br sells, as its paths name them. */
export const kiaModels = ["bongo", "carnival", "ev5", "ev9", "niro", "sorento", "sportage", "stonic", "tasman"];

export interface SitePage {
  /** The spec page, the source link. */
  url: string;
  /** The file in data/fichas/sites. */
  file: string;
  /** When it was downloaded (ISO date): what the site sells then is the year's 0 km. */
  fetched: string;
}

/** Each version's name on the model's page, by code: "N.855" → "Niro HEV EX". */
export function kiaNames(modelHtml: string): Map<string, string> {
  const names = new Map<string, string>();
  let name: string | undefined;
  for (const [, kind, html] of modelHtml.matchAll(/class="versao-(name|preconame)"[^>]*>([\s\S]*?)<\/(?:h\d|p)>/g)) {
    const text = htmlText(html!);
    if (kind === "name") name = text;
    const code = text.match(/c[óo]digo:\s*([A-Z]\.\d+)/i)?.[1];
    if (code && name) names.set(code, name.replace(code, "").trim());
  }
  return names;
}

// Words of a name that are not a trim: the hybrid systems, "Bongo COM A/C".
const notATrim = /^(hev|mhev|phev|com|sem|a|c)$/;

/** The sheets and equipment lists of a spec page, a version each. */
export function kiaSpecPage(specHtml: string, names: Map<string, string>, source: SitePage): { sheets: OpenSheet[]; lists: EquipmentList[] } {
  // The hidden table: "N.855.2627" for each row; the years of each code.
  const fields = new Map<string, { label: string; text: string }[]>();
  const years = new Map<string, [number, number]>();
  const hidden = specHtml.match(/id="tblFT"[\s\S]*?<\/table>/)?.[0] ?? "";
  for (const [, item, value, , version] of htmlRows(hidden).map((row) => row.map((cell) => cell.text))) {
    const found = version?.match(/^([A-Z]\.\d+)\.(\d\d)(\d\d)$/);
    if (!found || !item || !value) continue;
    const [, code, from, to] = found as unknown as [string, string, string, string];
    years.set(code, [2000 + Number(from), Math.max(2000 + Number(to), Number(source.fetched.slice(0, 4)))]);
    fields.set(code, [...(fields.get(code) ?? []), { label: item, text: value }]);
  }

  // The tables by code: the items under each group heading, and "Outras especificações".
  const groups = new Map<string, { name: string; items: string[] }[]>();
  for (const table of specHtml.matchAll(/<table[\s\S]*?<\/table>/g)) {
    if (table[0].includes('id="tblFT"')) continue;
    const heading = [...specHtml.slice(0, table.index).matchAll(/class="accordionTit">([^<]*)</g)].at(-1)?.[1];
    const groupName = heading ? htmlText(heading) : "Equipamentos";
    for (const [label, ...cells] of htmlRows(table[0])) {
      if (!label?.text || label.text === "Item") continue;
      for (const cell of cells) {
        const code = attribute(cell, "data-versao");
        if (!code || !cell.text || cell.text === "-") continue;
        if (!attribute(cell, "class")?.includes("ItemSerie")) {
          fields.set(code, [...(fields.get(code) ?? []), { label: label.text, text: cell.text }]);
          continue;
        }
        const ofCode = groups.get(code) ?? (groups.set(code, []), groups.get(code)!);
        const group = ofCode.find((item) => item.name === groupName) ?? ofCode[ofCode.push({ name: groupName, items: [] }) - 1]!;
        const item = cell.text === "●" ? label.text : `${label.text}: ${cell.text}`;
        if (!group.items.includes(item)) group.items.push(item);
      }
    }
  }

  const sheets: OpenSheet[] = [];
  const lists: EquipmentList[] = [];
  for (const [code, versionYears] of years) {
    const name = names.get(code);
    const versionFields = fields.get(code) ?? [];
    if (!name) continue;
    const [line = name, ...rest] = name.split(" ");
    const trims = words(rest.join(" ")).filter((word) => !notATrim.test(word));
    const valueOf = (pattern: RegExp) => versionFields.filter(({ label }) => pattern.test(plain(label))).map(({ text }) => text).join(" ");
    const engine = valueOf(/^motor$/);
    const fuel = valueOf(/^combustivel$/);
    const transmission = transmissionIn(valueOf(/^transmissao tipo|^relacao de transmissao/));
    const engineLiters = litersOf(`${valueOf(/^cilindrada/)} cm³`) ?? litersOf(engine);
    const electric = /el[eé]tric/i.test(engine);
    const hybrid = /\bm?hev\b|h[ií]brid/i.test(`${engine} ${name}`);
    const key = {
      brand: "kia" as const,
      line,
      trims,
      years: versionYears,
      ...(engineLiters !== undefined && !electric && { engineLiters }),
      // Diesels are all turbo, which FIPE does not always write ("Sorento EX 2.2 16V 4x4 Aut. Diesel"): left open.
      ...(turboIn(engine) && !/diesel/i.test(fuel) && { turbo: true }),
      electric,
      ...(hybrid && { hybrid: true }),
      ...(fuel && { diesel: /diesel/i.test(fuel) }),
      // Nor the hybrids' gearbox: "Niro EX 1.6 GDI (Híbrido)".
      ...(transmission && !hybrid && { transmission }),
      ...(!trims.length && { base: true }),
    };
    const title = `${line} · ${rest.join(" ") || code}`;
    const specs = specsOfFields(
      versionFields
        // The Arla 32 tank is not the fuel's, nor the bed's length the car's.
        .filter(({ label }) => !/arla|nox|ca[cç]amba|retomada/i.test(label))
        .map(({ label, text }) => ({ label, text: withUnit(label, text) })),
    );
    if (Object.keys(specs).length) sheets.push({ ...key, title, page: source.url, url: source.url, file: source.file, specs });
    const versionGroups = groups.get(code);
    if (versionGroups?.length) lists.push({ ...key, title, page: source.url, file: source.file, groups: versionGroups });
  }
  return { sheets, lists };
}
