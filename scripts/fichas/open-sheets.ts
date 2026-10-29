// Spec sheets of the press rooms that publish them openly: Volkswagen (one PDF
// per version, npm run fichas:vw) and Renault (a spreadsheet per line, with a
// column per version, npm run fichas:renault). Their figures, and how a sheet
// is matched to FIPE versions: by line, years, engine and transmission, since
// FIPE abbreviates the trims ("Comfor.", "Dyna.") and a sheet covers several.

import type { SheetSpecs } from "../../src/catalog/press.ts";

export type OpenBrand = "vw" | "renault";
export type Transmission = "automatico" | "manual";

/** A sheet read from a press room's file (data/fichas/fichas-abertas.json). */
export interface OpenSheet {
  brand: OpenBrand;
  /** The line as the press room names it ("Novo Polo", "Duster Oroch", "Kwid E-TECH"). */
  line: string;
  /** "Polo Highline 1.0 TSI Automático", "Duster Iconic Plus 1.3 TURBO". */
  title: string;
  /** The version words it names ("highline", "iconic", "plus"), to prefer among sheets. */
  trims: string[];
  /** The model years it is for. */
  years: [number, number];
  engineLiters?: number;
  /** Of the whole engine: 8, 12, 16. */
  valves?: number;
  turbo?: boolean;
  electric: boolean;
  transmission?: Transmission;
  /** Pickups: "cd" (double cab), "cs" (single) or "ce" (extended). */
  cab?: "cd" | "cs" | "ce";
  /** Where the press room shows it, and the file. */
  page: string;
  url: string;
  file: string;
  specs: SheetSpecs;
}

export interface OpenSheetsFile {
  _doc?: string;
  sheets: OpenSheet[];
}

export const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** "1.3" stays one word, "Z.E." is "ze", "E-TECH" is "e" and "tech". */
export const words = (text: string) =>
  plain(text)
    .split(/[^a-z0-9.]+/)
    // "R.S." is "rs", as FIPE writes it.
    .map((word) => word.replace(/^\.+|\.+$/g, "").replace(/(?<=[a-z])\.(?=[a-z])/g, ""))
    .filter(Boolean);
/** "4.095" → 4095, "1.598" → 1598, "20,4" → 20.4. */
const number = (text: string) => Number(text.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
const numberPattern = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)`;
/** The numbers of a text written before a unit: "109 cv (gasolina)", "4376mm". */
const before = (text: string, unit: string) =>
  [...plain(text).matchAll(new RegExp(`${numberPattern}\\s*${unit}`, "g"))].map((match) => number(match[1]!));
/** Every number of a text. */
const numbersIn = (text: string) => [...plain(text).matchAll(new RegExp(numberPattern, "g"))].map((match) => number(match[1]!));

// What a car's figures can be, to tell them from a table's other numbers.
const ranges: Record<keyof SheetSpecs, [number, number]> = {
  powerCv: [10, 900],
  torqueKgfm: [5, 160],
  weightKg: [400, 4500],
  lengthMm: [2000, 7500],
  widthMm: [1100, 2600],
  heightMm: [1100, 3200],
  wheelbaseMm: [1600, 4600],
  groundClearanceMm: [90, 400],
  trunkLiters: [100, 2000],
  tankLiters: [25, 200],
  topSpeedKmh: [40, 350],
  zeroTo100s: [2.5, 30],
};
const plausible = (key: keyof SheetSpecs) => (value: number) =>
  Number.isFinite(value) && value >= ranges[key][0] && value <= ranges[key][1];

/** A sheet's figures, from its fields (label and text, any number of each). */
export function specsOfFields(fields: { label: string; text: string }[]): SheetSpecs {
  const specs: SheetSpecs = {};
  const of = (pattern: RegExp, not?: RegExp) =>
    fields.filter(({ label }) => pattern.test(plain(label)) && !not?.test(plain(label)));
  const set = (key: keyof SheetSpecs, values: number[], pick: "first" | "max" | "min" = "first") => {
    const found = values.filter(plausible(key));
    if (!found.length) return;
    specs[key] = pick === "max" ? Math.max(...found) : pick === "min" ? Math.min(...found) : found[0]!;
  };
  // A unit in the label ("Peso (kg)", "Porta-malas (litros)") covers bare numbers.
  // Bare numbers too when the cell holds nothing else ("145", "1.728/1.762").
  const onlyNumbers = (text: string) => /^[\d.,\s/]+$/.test(text.trim());
  const valuesOf = (matching: { label: string; text: string }[], unit: string, labelUnit: RegExp) =>
    matching.flatMap(({ label, text }) => {
      const withUnit = before(text, unit);
      return withUnit.length ? withUnit : labelUnit.test(plain(label)) || onlyNumbers(text) ? numbersIn(text) : [];
    });
  // Meters too: "2,70 metros".
  const millimeters = (matching: { label: string; text: string }[]) =>
    matching.flatMap(({ label, text }) => {
      const mm = before(text, "mm");
      if (mm.length) return mm;
      const meters = before(text, "(?:metros?|m)\\b").map((value) => Math.round(value * 1000));
      return meters.length ? meters : /\(mm\)/.test(plain(label)) || onlyNumbers(text) ? numbersIn(text) : [];
    });

  // VW: "Potência máxima - kW (cv) / rpm … 85 (116) / 5500"; Renault: "109 cv (gasolina)".
  const power = of(/potencia/);
  const kwCv = power.flatMap(({ text }) => [...text.matchAll(/\d+\s*\((\d+)\)/g)].map((match) => Number(match[1])));
  // "potência máxima (cv) | 115 (etanol) a 5.750 rpm": the label gives the unit.
  // Not "kW (cv)", whose cells hold both.
  const powerInLabel = power
    .filter(({ label }) => /\(cv\)/.test(plain(label)) && !/kw/.test(plain(label)))
    .flatMap(({ text }) => numbersIn(text));
  set("powerCv", [...before(power.map((field) => field.text).join(" "), "cv"), ...kwCv, ...powerInLabel], "max");
  const torque = of(/torque/);
  const nmKgfm = torque.flatMap(({ text }) => [...text.matchAll(/\d+\s*\((\d+[,.]\d+)\)/g)].map((match) => number(match[1]!)));
  const kgfmInLabel = torque
    .filter(({ label }) => /\(kgfm\)/.test(plain(label)) && !/nm/.test(plain(label)))
    .flatMap(({ text }) => numbersIn(text));
  const kgfm = [...before(torque.map((field) => field.text).join(" "), "kgf\\.?\\s?m"), ...nmKgfm, ...kgfmInLabel];
  const newtonMeters = before(torque.map((field) => field.text).join(" "), "n\\.?m").map(
    (value) => Math.round((value / 9.80665) * 10) / 10,
  );
  set("torqueKgfm", kgfm.length ? kgfm : newtonMeters, "max");
  set("weightKg", valuesOf(of(/ordem de marcha|^peso(?! (bruto|da bateria|maximo))/), "kg", /\(kg\)|pesos/));
  // "4.379 mm de comprimento, 1.813 mm de largura …, 1.619 mm de altura e 2.673 mm de entre-eixos".
  const dimensions = of(/^dimens/).map((field) => plain(field.text)).join(" ");
  const inDimensions = (word: string) =>
    [...dimensions.matchAll(new RegExp(`${numberPattern}\\s*mm de ${word}`, "g"))].map((match) => number(match[1]!));
  set("lengthMm", [...millimeters(of(/^comprimento/)), ...inDimensions("comprimento")]);
  // "Largura / Largura com retrovisores | 1.639 mm / 1.940 mm": the first is without mirrors.
  set("widthMm", [...millimeters(of(/^largura/, /^largura (total )?com|^largura de carga/)), ...inDimensions("largura")]);
  set("heightMm", [...millimeters(of(/^altura/, /solo|livre|piso/)), ...inDimensions("altura")]);
  set("wheelbaseMm", [...millimeters(of(/entre.?eixos/)), ...inDimensions("entre.?eixos")]);
  set("groundClearanceMm", millimeters(of(/(altura|vao|distancia) (livre )?do solo|altura livre|vao livre/)));
  set("trunkLiters", valuesOf(of(/porta.?malas/), "(?:litros|l)\\b", /litros|capacidades|\(l\)/));
  set("tankLiters", valuesOf(of(/tanque(?! de ureia)/), "(?:litros|l)\\b", /litros|capacidades|\(l\)/));
  set("topSpeedKmh", valuesOf(of(/velocidade maxima/), "km\\s?/\\s?h", /km\/h/), "max");
  // Seconds, written or not: "11,5 (gasolina)", "9,2 segundos", "10,1 9,6".
  // "o - 100 km/h (s)" has a letter for the zero; "80 km/h" is not 8 s.
  const seconds = of(/[0o]\s*(a|-)\s*100/).flatMap(({ text }) =>
    [...plain(text).matchAll(new RegExp(`${numberPattern}(?![\\d.,]|\\s*(?:km|cv|m\\b))`, "g"))].map((match) =>
      number(match[1]!),
    ),
  );
  set("zeroTo100s", seconds, "min");
  return specs;
}

/** "1.598 cm³" → 1.6, "1.0l TSI" → 1.0, "999 cm³" → 1.0. */
export function litersOf(text: string): number | undefined {
  const cc = plain(text).match(/(\d{1,2}\.?\d{3}|\d{3,4})\s*cm/);
  if (cc) return Math.round(number(cc[1]!) / 100) / 10;
  const liters = plain(text).match(/(?<![\d.,])(\d)[.,](\d)\s*(?:l\b|16v|12v|8v|20v|tsi|tdi|tce|turbo|sce|hi|\b)/);
  return liters ? Number(`${liters[1]}.${liters[2]}`) : undefined;
}

export const turboIn = (text: string) => /turbo|tsi\b|tdi\b|tce\b|\btb\b|diesel|dci\b/.test(plain(text));
const electricIn = (text: string) => /eletric|electric|z\.?e\.?\b|e-tech/.test(plain(text));
export function transmissionIn(text: string): Transmission | undefined {
  const value = plain(text);
  if (/autom|cvt|dsg|tiptronic|uma marcha a frente/.test(value)) return "automatico";
  if (/manual|mecanic|\bmt\b|\bmec\b/.test(value)) return "manual";
  return undefined;
}
function cabIn(text: string): "cd" | "cs" | "ce" | undefined {
  const value = ` ${plain(text).replace(/[^a-z0-9]+/g, " ")} `;
  if (/ cd | cabine dupla /.test(value)) return "cd";
  if (/ cs | cabine simples /.test(value)) return "cs";
  if (/ ce | cabine estendida /.test(value)) return "ce";
  return undefined;
}
/** "16 válvulas", "16V", or "4 / Em linha / 4" (cylinders, layout, valves per cylinder). */
export function valvesIn(text: string): number | undefined {
  const value = plain(text);
  const perCylinder = value.match(/(\d)\s*\/\s*(?:em linha|em v|v)\s*\/\s*(\d)\b/);
  if (perCylinder) return Number(perCylinder[1]) * Number(perCylinder[2]);
  const total = value.match(/\b(8|12|16|20|24)\s*(?:v\b|valvulas)/);
  return total ? Number(total[1]) : undefined;
}

// Words of a line or a version name that are not part of the line or a trim.
const notALineWord = /^(novo|nova|new|ficha|tecnica|volkswagen|vw|renault|\d.*)$/;
/** The words that name a line: "Novo Jetta GLI" → jetta gli, "Kwid E-TECH" → kwid e tech. */
export const lineWords = (line: string) => words(line).filter((word) => !notALineWord.test(word));

export interface VwLink {
  model: string;
  title: string;
  pdf: string | null;
  file: string | null;
  page: string;
}

/**
 * A Volkswagen sheet from its PDF's text lines: "Ficha Técnica Polo 1.0l TSI
 * 94kW* / Automático", then "Label value" lines. When a cell sits lower than
 * its label, the value comes on the line before ("2565" + "Distância entre eixos").
 * Its years: those of "Dados Oficiais: Setembro/2017" and the next.
 */
export function vwSheet(lines: string[], link: VwLink): OpenSheet | undefined {
  const heading = lines
    .slice(0, 3)
    .join(" ")
    .replace(/ficha t[eé]cnica|vendas & marketing/gi, " ")
    .replace(/\*/g, "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const official = lines.join(" ").match(/dados oficiais:?[^0-9]*(?:\d{1,2}\/)?[a-zç]*\s*\/?\s*(20\d\d)/i)?.[1];
  if (!official || !link.pdf || !link.file) return undefined;
  const fields: { label: string; text: string }[] = [];
  let pending: string | undefined;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!/\p{L}/u.test(line)) {
      pending = line;
      continue;
    }
    // The label runs to its last parenthesis: "Aceleração 0-100 km/h (s) 10,1 9,6".
    const split = line.match(/^(.*\p{L}.*\))\s+(\d.*)$/u) ?? line.match(/^(.*?\p{L}[^\d]*?)\s+(\d.*)$/u);
    if (split) fields.push({ label: split[1]!, text: split[2]! });
    else if (pending) fields.push({ label: line, text: pending });
    else fields.push({ label: line, text: "" });
    pending = undefined;
  }
  // "Comprimento 4057" under "DIMENSÕES EXTERNAS (mm)": the section gives the unit.
  let section = "";
  const withUnits = fields.map((field) => {
    const bare = field.label.replace(/\(.*?\)/g, "");
    if (!field.text && /\p{L}/u.test(bare) && bare === bare.toUpperCase()) section = plain(field.label);
    const unit = section.match(/\((mm|litros|kg)\)/)?.[0] ?? "";
    return { label: `${field.label} ${unit}`, text: field.text };
  });
  const specs = specsOfFields(withUnits);
  if (!Object.keys(specs).length) return undefined;
  const year = Number(official);
  const engine = `${heading} ${fields.find((field) => /cilindrada/i.test(field.label))?.text ?? ""} cm³`;
  const liters = litersOf(heading) ?? litersOf(engine);
  const transmission = transmissionIn(heading) ?? transmissionIn(fields.find((field) => /^(automática|manual)/i.test(field.label))?.label ?? "");
  const cab = cabIn(heading);
  // The figures may sit on a line of their own ("4 / Em linha / 2").
  const valves =
    valvesIn(fields.filter((field) => /cilindros/i.test(field.label)).map((field) => `${field.label} ${field.text}`).join(" ")) ??
    valvesIn(lines.join(" "));
  return {
    brand: "vw",
    line: link.model,
    title: `${link.title} (${heading.replace(/(\d)[.,](\d)l\b/, "$1.$2")})`,
    trims: words(link.title).filter((word) => !lineWords(link.model).includes(word) && !notALineWord.test(word)),
    years: [year, year + 1],
    ...(liters !== undefined && { engineLiters: liters }),
    ...(valves && { valves }),
    turbo: turboIn(heading),
    electric: electricIn(heading),
    ...(transmission && { transmission }),
    ...(cab && { cab }),
    page: link.page,
    url: link.pdf,
    file: link.file,
    specs,
  };
}

export interface RenaultLink {
  vehicle: string;
  excel: string | null;
  file: string | null;
  page: string;
}

// The labels of a Renault sheet's rows, to tell them from a section's title.
const renaultLabel =
  /^(arquitetura|motor|tracao|cilindrada|diametro|potencia|torque|alimentacao|rodas|pneus|suspensao|freios|direcao|cambio|relac|diferencial|tanque|porta|carga|peso|comprimento|entre|altura|largura|aceleracao|velocidade|combustivel|consumo|angulo|taxa|bateria|autonomia|carregador|tempo|dimens|volume|cacamba|versoes|cidade|estrada|porta de)/;

const renaultGroup =
  /^(desempenho|transmiss|direc|suspens|freios|pneus|combust|motor|dimens|capacidad|pesos?|carga|consumo|conforto|design|seguranc|tecnologia|multimidia|equipamentos?|estrutura|garantia)/;

/**
 * The sheets of a Renault spreadsheet: one per section (a row with only a
 * title, "Kangoo Z.E.") and version column ("Intense Plus 1.6 MT"). An empty
 * cell repeats the one on its left; a row without a label continues the one
 * above. Its years: the title's ("DUSTER 2026") or the file's, and the next.
 */
export function renaultSheets(rows: string[][], link: RenaultLink, modified: Date | undefined): OpenSheet[] {
  if (!link.excel || !link.file) return [];
  type Section = { title: string; headers: string[][]; rows: string[][] };
  const sections: Section[] = [];
  // Labels in the second column, the first holding a drawing's letters ("A", "L1/L2") or nothing.
  const shifted = (row: string[]) =>
    Boolean(row[1]) && (!row[0] || /^[A-Z]{1,2}\d?(\/[A-Z]{1,2}\d?)*$/.test(row[0]!)) && renaultLabel.test(plain(row[1]!));
  const shift = rows.filter(shifted).length > rows.length / 3;
  for (const original of rows) {
    const row = shift && (shifted(original) || !original[0]) ? original.slice(1) : original;
    const [first = "", ...rest] = row;
    const filled = rest.filter(Boolean);
    const isLabel = renaultLabel.test(plain(first));
    const current = sections.at(-1);
    // A group's heading ("DESEMPENHO", "TRANSMISSÃO") is not a vehicle of its own.
    if (current && !filled.length && renaultGroup.test(plain(first))) continue;
    if (first && !isLabel && (!filled.length || !current)) {
      sections.push({ title: [first, ...filled].join(" "), headers: [], rows: [] });
    } else if (!current) {
      sections.push({ title: link.vehicle, headers: [], rows: [row] });
    } else if ((!first || /^vers/.test(plain(first))) && filled.length && !current.rows.length) {
      current.headers.push(row);
    } else {
      current.rows.push(row);
    }
  }

  const sheets: OpenSheet[] = [];
  for (const section of sections) {
    const columns = Math.max(1, ...section.headers.map((header) => header.length - 1));
    // Header cells too: "1.6 16V" over "Expression/Dynamique".
    const columnName = (column: number) =>
      section.headers
        .map((header) => header.slice(1, column + 1).reverse().find(Boolean) ?? "")
        .filter(Boolean)
        .join(" ");
    const titleYear = section.title.match(/\b(20\d\d)\b/)?.[1];
    const year = titleYear ? Number(titleYear) : modified?.getFullYear();
    if (!year) continue;
    // A sheet of several vehicles names each in its section; one of a line, by its link.
    const line = sections.length > 1 ? section.title.replace(/ficha t[eé]cnica|novo|\(.*\)|\b20\d\d\b/gi, " ").trim() : link.vehicle;
    for (let column = 1; column <= columns; column++) {
      const fields: { label: string; text: string }[] = [];
      for (const row of section.rows) {
        const cell = row.slice(1, column + 1).reverse().find(Boolean) ?? "";
        if (row[0]) fields.push({ label: row[0], text: cell });
        else if (fields.length) fields.at(-1)!.text += ` ${cell}`;
      }
      const specs = specsOfFields(fields);
      if (!Object.keys(specs).length) continue;
      const name = columnName(column);
      const field = (pattern: RegExp) => fields.filter((item) => pattern.test(plain(item.label))).map((item) => item.text).join(" ");
      const engine = `${name} ${field(/^cilindrada|^motor|^versoes/)}`;
      const liters = litersOf(field(/^cilindrada/)) ?? litersOf(engine);
      const electric = /eletric/.test(plain(field(/^motor/)));
      // The gearbox row says it; the column's name may name another ("CVT" over the manual).
      const transmission = transmissionIn(field(/^cambio/)) ?? transmissionIn(name);
      const valves = electric ? undefined : valvesIn(engine);
      const cleanTitle = section.title.replace(/ficha t[eé]cnica\s*-?\s*/gi, "").replace(/\s+/g, " ").trim();
      // Two columns may share a heading ("Dynamique / … CVT" over the manual and the CVT): the gearbox tells them apart.
      const gearbox = transmission && !electric && !transmissionIn(name) ? (transmission === "manual" ? "manual" : "automático") : "";
      sheets.push({
        brand: "renault",
        line,
        title: [sections.length > 1 || /\d/.test(cleanTitle) ? cleanTitle : link.vehicle, name, gearbox].filter(Boolean).join(" · "),
        trims: words(name).filter((word) => !/^\d|^(mt|cvt|turbo|at)$/.test(word)),
        years: [year, year + 1],
        ...(liters !== undefined && !electric && { engineLiters: liters }),
        ...(valves && { valves }),
        turbo: turboIn(engine),
        electric,
        ...(transmission && { transmission }),
        page: link.page,
        url: link.excel,
        file: link.file,
        specs,
      });
    }
  }
  return sheets;
}

/** FIPE brands of each press room. */
const fipeBrands: Record<OpenBrand, string[]> = { vw: ["VW - VolksWagen"], renault: ["Renault"] };

export interface OpenSheetTarget {
  brand: string;
  family: string;
  name: string;
  modelYear: number;
  engineLiters?: number;
  valves?: number;
  turbo: boolean;
  electric: boolean;
}

// Sheets merged for versions that several fit equally, one object per set, so the index lists each once.
const merged = new Map<string, OpenSheet>();

/** The figures several sheets share, under a title naming them all ("Kwid · Zen / Intense"). */
function common(sheets: OpenSheet[]): OpenSheet {
  const key = sheets.map((sheet) => `${sheet.file}|${sheet.title}`).sort().join("\n");
  const known = merged.get(key);
  if (known) return known;
  const [first] = sheets as [OpenSheet, ...OpenSheet[]];
  const specs: SheetSpecs = {};
  for (const [field, value] of Object.entries(first.specs) as [keyof SheetSpecs, number][]) {
    if (sheets.every((sheet) => sheet.specs[field] === value)) specs[field] = value;
  }
  // "DUSTER 2026 · Intense Plus 1.6 MT", "Polo Highline (Polo 1.0 TSI …)": the part that differs.
  const prefix = first.title.includes(" · ") ? first.title.split(" · ")[0]! : first.line;
  let names = [
    ...new Set(
      sheets.map((sheet) =>
        sheet.title.includes(" · ") ? sheet.title.split(" · ").slice(1).join(" · ") : sheet.title.split(" (")[0]!,
      ),
    ),
  ];
  // Once, the part all share: "Iconic / Intense · manual", not "Iconic · manual / Intense · manual".
  const shared = names[0]!.match(/ · [^·]+$/)?.[0];
  if (shared && names.every((name) => name.endsWith(shared))) names = names.map((name) => name.slice(0, -shared.length));
  const sheet: OpenSheet = { ...first, title: `${prefix} · ${names.join(" / ")}${shared && !names[0]!.endsWith(shared) ? shared : ""}`, trims: [], specs };
  merged.set(key, sheet);
  return sheet;
}

/**
 * The sheet of a version-year: same brand, line (its first word is the FIPE
 * family's, and the version names its other words: "Duster Oroch", "Kwid
 * E-TECH"), within its years, with no clash in engine size, turbo, electric,
 * transmission or cab. A line with a longer name ("Duster Oroch") keeps its
 * versions from the shorter one's sheet ("Duster"). Among those left, the one
 * naming most of the version's words ("Iconic Plus"), then the nearest years;
 * several that fit as well give only the figures they share.
 */
export function openSheetOfVersion(sheets: OpenSheet[], target: OpenSheetTarget): OpenSheet | undefined {
  const tied = bestOfVersion(sheets, target);
  // The same sheet listed for several versions (VW's T-Cross) is still one.
  const distinct = [...new Map(tied.map((sheet) => [`${sheet.file}|${sheet.title}`, sheet])).values()];
  return distinct.length <= 1 ? distinct[0] : common(distinct);
}

/** What a sheet or an equipment list says it is for. */
export type SheetKey = Pick<
  OpenSheet,
  "brand" | "line" | "trims" | "years" | "engineLiters" | "valves" | "turbo" | "electric" | "transmission" | "cab"
>;

/**
 * The sheets that fit a version-year best (see openSheetOfVersion), all tied.
 * With `trimNamed`, only those whose trim the version names: equipment
 * changes with the trim, figures mostly with the engine.
 */
export function bestOfVersion<T extends SheetKey>(sheets: T[], target: OpenSheetTarget, { trimNamed = false } = {}): T[] {
  const nameWords = words(target.name);
  const family = words(target.family)[0] ?? "";
  const automatic = /\b(aut|automatico|automatica|cvt|tiptronic|tipt|dsg|at\d?)\b|s.?tronic/.test(plain(target.name));
  const versionCab = cabIn(target.name);
  // A version word matches a trim it starts: "comfor" is "comfortline", "dyna" "dynamique", "prem" "premiere".
  const names = (word: string) => nameWords.some((own) => own === word || (own.length >= 3 && word.startsWith(own.replace(/\.$/, ""))));
  const ofBrand = sheets.filter((sheet) => fipeBrands[sheet.brand].includes(target.brand));
  const fitting: { sheet: T; score: number }[] = [];
  for (const sheet of ofBrand) {
    const own = lineWords(sheet.line);
    if (own[0] !== family || !own.every(names)) continue;
    const longer = ofBrand.some((other) => {
      const theirs = lineWords(other.line);
      return theirs.length > own.length && theirs[0] === family && theirs.every(names);
    });
    if (longer) continue;
    if (target.modelYear < sheet.years[0] || target.modelYear > sheet.years[1]) continue;
    if (sheet.electric !== target.electric) continue;
    if (sheet.engineLiters !== undefined && target.engineLiters !== undefined && Math.abs(sheet.engineLiters - target.engineLiters) > 0.05) continue;
    if (!sheet.electric && sheet.turbo !== undefined && sheet.turbo !== target.turbo) continue;
    if (sheet.transmission === "automatico" && !automatic) continue;
    if (sheet.transmission === "manual" && automatic) continue;
    if (sheet.valves && target.valves && sheet.valves !== target.valves) continue;
    // A sheet of a cab is of that cab only: FIPE names the double and extended ones, not always the single.
    if (sheet.cab && sheet.cab !== (versionCab ?? "cs")) continue;
    const named = sheet.trims.filter(names).length;
    if (trimNamed && !named) continue;
    const distance = Math.abs(target.modelYear - (sheet.years[0] + sheet.years[1]) / 2);
    // One that says the engine and the gearbox (and they fit) over one that leaves them open.
    const precise = (sheet.engineLiters !== undefined ? 1 : 0) + (sheet.transmission ? 1 : 0);
    fitting.push({ sheet, score: named * 10 + precise - distance });
  }
  const best = Math.max(...fitting.map((item) => item.score));
  return fitting.filter((item) => item.score === best).map((item) => item.sheet);
}
