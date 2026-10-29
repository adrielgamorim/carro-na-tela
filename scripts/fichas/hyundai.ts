// Hyundai's digital catalogs (PDFs the Wayback Machine kept of hyundai.com.br,
// npm run fichas:wayback), one per version ("Novo HB20 Platinum"). Each ends
// the same way: "Ficha técnica" (engine, gearbox, power, torque, top speed,
// 0 to 100, each value on the line after its label), "Válida para veículos
// com ano de fabricação/modelo 2023/2024", "Dimensões" (the figures without
// their labels: each has its own range) and "Lista de equipamentos" (groups
// and their items, every item standard).

import type { PdfTextLine } from "../inmetro/pbev.ts";
import type { EquipmentGroup, EquipmentList } from "./equipment.ts";
import { litersOf, plain, specsOfFields, transmissionIn, words } from "./open-sheets.ts";
import type { OpenSheet } from "./open-sheets.ts";

export interface HyundaiFile {
  file: string;
  /** The archived copy, the source link. */
  url: string;
}

/** The text lines of a PDF, top to bottom, cells joined by " | ". */
export function textLines(lines: PdfTextLine[]): string[] {
  return [...lines]
    .sort((a, b) => a.page - b.page || b.y - a.y)
    .map((line) => [...line.cells].sort((a, b) => a.center - b.center).map((cell) => cell.text.trim()).filter(Boolean).join(" | "))
    .filter(Boolean);
}

// The lines FIPE has; the order matters ("HB20S" before "HB20").
const lines: [RegExp, string][] = [
  [/\bhb20s\b/i, "HB20S"],
  [/\bhb20\b/i, "HB20"],
  [/\bcreta\b/i, "Creta"],
  [/\bkona\b/i, "Kona"],
  [/\bpalisade\b/i, "Palisade"],
  [/\bioniq\s*5\b/i, "Ioniq 5"],
  [/\btucson\b/i, "Tucson"],
];
const groupNames =
  /^(estilo exterior|estilo interior|seguran[cç]a|conforto e conveni[eê]ncia|sistema de [aá]udio e conectividade|tecnologia|conectividade|multim[ií]dia|rodas e pneus|desempenho)$/i;

const specLabel =
  /^(motor|transmiss|c[aâ]mbio|pot[eê]ncia|torque|velocidade|acelera|consumo|combust|tra[cç][aã]o|dire[cç][aã]o|freios|suspens|pneus|rodas|tanque|peso|porta-malas|autonomia|bateria)/i;

/** The model year a catalog is for: "ano de fabricação/modelo 2023/2024", else its name's ("-2025", "25-26"). */
export function hyundaiYear(text: string[], file: string): number | undefined {
  const valid = text.join(" ").match(/fabrica[cç][aã]o\s*\/\s*modelo\s*(20\d\d)\s*\/\s*(20\d\d)/i);
  if (valid) return Number(valid[2]);
  const span = file.match(/(?:my-?)?(\d\d)-(\d\d)(?:\.pdf|-)/);
  if (span && Number(span[2]) === Number(span[1]) + 1) return 2000 + Number(span[2]);
  const year = file.match(/-(20[12]\d)(?:-|\.pdf)/)?.[1];
  return year ? Number(year) : undefined;
}

/**
 * The figures of "Dimensões", which the catalog writes without their labels:
 * the length is the largest (over 3.500 mm), the wheelbase 2.300–3.200, and
 * of the two left the wider is the width. Liters before "(banco rebatido)"
 * is the trunk with the seat down, so only the first liters count.
 */
export function hyundaiDimensions(section: string[]): Record<string, number> {
  const mm = [...section.join(" ").matchAll(/(\d\.\d{3})\s*mm/g)].map((match) => Number(match[1]!.replace(".", "")));
  const found: Record<string, number> = {};
  const length = Math.max(...mm.filter((value) => value > 3500));
  if (Number.isFinite(length)) found.lengthMm = length;
  const wheelbase = mm.find((value) => value >= 2300 && value <= 3200 && value !== length);
  if (wheelbase) found.wheelbaseMm = wheelbase;
  const rest = mm.filter((value) => value >= 1300 && value < 2100).sort((a, b) => b - a);
  if (rest.length >= 2) {
    found.widthMm = rest[0]!;
    found.heightMm = rest[1]!;
  }
  const trunk = section.join(" ").match(/(\d{3,4})\s*litros/)?.[1];
  if (trunk) found.trunkLiters = Number(trunk);
  return found;
}

/** The version's words in a catalog's file name: after the line's, without dates or engine codes. */
export function hyundaiFileTrims(file: string, lineWord: string): string[] {
  const parts = file.replace(/\.pdf$/i, "").split("-");
  const at = parts.indexOf(lineWord);
  if (at < 0) return [];
  return parts
    .slice(at + 1)
    .filter((part) => !/^(\d+|my\d*|janeiro|fevereiro|digital|catalogo|tgdi|auto|mobile|bx)$/.test(part));
}

/** A Hyundai catalog's sheet and equipment list, for its one version. */
export function hyundaiCatalog(
  pdfLines: PdfTextLine[],
  source: HyundaiFile,
): { sheet?: OpenSheet; list?: EquipmentList } {
  const text = textLines(pdfLines);
  const title = text[0] ?? "";
  const line = lines.find(([pattern]) => pattern.test(title))?.[1];
  const year = hyundaiYear(text, source.file);
  if (!line || !year) return {};
  // The version's words: the title's after the line ("Novo HB20 Platinum Safety" → platinum, safety);
  // when the cover puts them on another line, the file's name's ("…-hb20-platinum-plus-2024.pdf").
  const lineWord = plain(line).replace(/\s+/g, "");
  const ownWord = (word: string) => !/^(novo|nova|hyundai)$/.test(word) && word.replace(/\s+/g, "") !== lineWord && !/^\d/.test(word);
  const fromTitle = words(title).filter(ownWord);
  const fromFile = hyundaiFileTrims(source.file, lineWord);
  const trims = fromTitle.length ? fromTitle : fromFile;
  const shown = fromTitle.length ? title.replace(/^novo\s+/i, "").replace(/^hyundai\s+/i, "") : [line, ...fromFile].join(" ");
  const name = `${line} ${year} · ${shown}`.replace(/\s+/g, " ");

  // "Ficha técnica": each label, then its value on the next line ("Motor | Kappa…" has both).
  const start = text.findIndex((row) => /^ficha t[eé]cnica$/i.test(row));
  const end = text.findIndex((row, index) => index > start && /^(cores externas|dimens[oõ]es|e: etanol)/i.test(row));
  const fields: { label: string; text: string }[] = [];
  if (start >= 0) {
    for (let index = start + 1; index < (end > start ? end : text.length); index++) {
      const row = text[index]!;
      const [label, ...rest] = row.split(" | ");
      // A label by its name, digits or not ("Aceleração de 0 a 100 km/h (s)"); else the value of the one above.
      if (rest.length && specLabel.test(label!)) fields.push({ label: label!, text: rest.join(" ") });
      else if (specLabel.test(row)) fields.push({ label: row, text: "" });
      else if (fields.length && !fields.at(-1)!.text) fields.at(-1)!.text = row;
    }
  }
  // "120 (E) | 120 (G) @ 6.000 rpm" under "Potência máxima (cv)": the label says the unit.
  const withUnits = fields.map(({ label, text: value }) => {
    const first = value.match(/^\s*(\d+(?:,\d+)?)/)?.[1];
    if (first && /\(cv\)/i.test(label)) return { label, text: `${first} cv` };
    if (first && /\(kgf\.?m\)/i.test(label)) return { label, text: `${first} kgfm` };
    if (first && /\(km\/h\)/i.test(label)) return { label, text: `${first} km/h` };
    if (first && /0 a 100/i.test(label)) return { label, text: `${first} s` };
    return { label, text: value };
  });
  const dimensions = text.findIndex((row) => /^dimens[oõ]es$/i.test(row));
  const equipmentStart = text.findIndex((row) => /^lista de equipamentos$/i.test(row));
  const specs = {
    ...specsOfFields(withUnits),
    ...(dimensions >= 0 ? hyundaiDimensions(text.slice(dimensions, equipmentStart > dimensions ? equipmentStart : dimensions + 12)) : {}),
  };
  const engine = withUnits.find((field) => /^motor/i.test(field.label))?.text ?? "";
  const gearbox = withUnits.find((field) => /^transmiss/i.test(field.label))?.text ?? "";
  const liters = litersOf(engine.replace(/(\d[.,]\d)\s*l\b/i, "$1 "));
  const transmission = transmissionIn(gearbox);
  const hybrid = /h[ií]brid|hybrid/i.test(`${title} ${engine}`);
  const electric = /el[eé]tric|ioniq/i.test(`${title} ${engine}`) && liters === undefined;
  const key = {
    brand: "hyundai" as const,
    line,
    trims,
    years: [year, year] as [number, number],
    ...(liters !== undefined && { engineLiters: liters }),
    turbo: /turbo|t-?gdi/i.test(engine),
    electric,
    ...(hybrid && { hybrid: true }),
    ...(transmission && { transmission }),
  };

  const groups: EquipmentGroup[] = [];
  if (equipmentStart >= 0) {
    for (const row of text.slice(equipmentStart + 1)) {
      if (/^(click to buy|hyundai motor brasil|imagens meramente|a forma mais f[aá]cil)/i.test(row)) break;
      if (groupNames.test(row)) groups.push({ name: row.charAt(0).toUpperCase() + row.slice(1).toLowerCase(), items: [] });
      else if (groups.length && /^[a-zà-ú(]/.test(row) && groups.at(-1)!.items.length) {
        const items = groups.at(-1)!.items;
        items[items.length - 1] += ` ${row}`;
      } else if (groups.length) groups.at(-1)!.items.push(row.replace(/\s*\|\s*/g, " "));
    }
  }
  const listed = groups.filter((group) => group.items.length);

  return {
    ...(Object.keys(specs).length > 0 && {
      sheet: { ...key, title: name, page: source.url, url: source.url, file: source.file, specs },
    }),
    ...(listed.length > 0 && {
      list: { ...key, title: name, page: source.url, file: source.file, groups: listed },
    }),
  };
}
