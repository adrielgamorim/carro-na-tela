// Size, mass and power from the infobox of a Wikipedia article ("Info/
// Automóvel" in Portuguese, "Infobox automobile" in English), for the models
// Wikidata has no numbers for. Values come in many shapes:
//
//   {{converter|2521|mm|in|3|o=l}}     {{cvt|1105|-|1279|kg|lb|0}}
//   3.998 mm (pt)   3,998 mm (en)   4,07 m   82 a 116 cv   1.0 (72/77 cv)
//
// so everything is read into SI units (power in cv) and kept only when
// plausible for a car. An article describes the line, so these are approximate.

import type { ModelSpecs, SpecRange } from "../../src/catalog/wikidata.ts";

export type InfoboxSpecs = ModelSpecs & { power?: SpecRange };

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Field names (accents, case and dashes ignored) → spec.
const fieldKeys: Record<string, keyof InfoboxSpecs> = {
  comprimento: "length",
  length: "length",
  largura: "width",
  width: "width",
  altura: "height",
  height: "height",
  "distancia entre os eixos": "wheelbase",
  "distancia entre eixos": "wheelbase",
  "entre eixos": "wheelbase",
  wheelbase: "wheelbase",
  peso: "mass",
  massa: "mass",
  weight: "mass",
  "curb weight": "mass",
  potencia: "power",
  power: "power",
  // Power is often only in the engine list: "1.0 Firefly (72/77 cv)".
  motor: "power",
  engine: "power",
};

const limits: Record<keyof InfoboxSpecs, [number, number]> = {
  length: [2, 7],
  width: [1.2, 2.7],
  height: [0.9, 3.5],
  wheelbase: [1.5, 4.8],
  mass: [400, 6000],
  power: [30, 2000],
};

// Unit → factor to meters, kilograms or cv.
const units: Record<string, { kind: "length" | "mass" | "power"; factor: number }> = {
  mm: { kind: "length", factor: 0.001 },
  cm: { kind: "length", factor: 0.01 },
  m: { kind: "length", factor: 1 },
  kg: { kind: "mass", factor: 1 },
  t: { kind: "mass", factor: 1000 },
  lb: { kind: "mass", factor: 0.45359237 },
  cv: { kind: "power", factor: 1 },
  ps: { kind: "power", factor: 1 },
  hp: { kind: "power", factor: 1.01387 },
  bhp: { kind: "power", factor: 1.01387 },
  kw: { kind: "power", factor: 1.35962 },
};

/** The fields of the first car infobox, split at its top level. */
export function infoboxFields(wikitext: string): Map<string, string> {
  const fields = new Map<string, string>();
  const start = wikitext.search(/\{\{\s*(info\/autom[oó]vel|infobox automobile)/i);
  if (start < 0) return fields;
  let depth = 0;
  let part = "";
  const parts: string[] = [];
  for (let index = start; index < wikitext.length; index++) {
    const pair = wikitext.slice(index, index + 2);
    if (pair === "{{" || pair === "[[") {
      depth++;
      part += pair;
      index++;
      continue;
    }
    if (pair === "}}" || pair === "]]") {
      depth--;
      if (depth === 0) break;
      part += pair;
      index++;
      continue;
    }
    if (wikitext[index] === "|" && depth === 1) {
      parts.push(part);
      part = "";
      continue;
    }
    part += wikitext[index];
  }
  parts.push(part);
  for (const item of parts.slice(1)) {
    const equals = item.indexOf("=");
    if (equals < 0) continue;
    fields.set(plain(item.slice(0, equals)), item.slice(equals + 1).trim());
  }
  return fields;
}

/** A number as written: "3.998" (pt thousands), "3,998" (en thousands), "4,07" (decimal). */
function parseNumber(text: string, unit: string): number {
  const value = text.replace(/\s/g, "");
  // In mm, kg, lb, cv a separator before exactly three digits groups thousands.
  if (/^\d{1,3}([.,]\d{3})+$/.test(value) && unit !== "m" && unit !== "t") {
    return Number(value.replace(/[.,]/g, ""));
  }
  return Number(value.replace(",", "."));
}

/** Every quantity of the given kind in a field value, in SI units (cv for power). */
export function quantities(value: string, kind: "length" | "mass" | "power"): number[] {
  const text = value
    .replace(/<ref[^>]*\/>/g, " ")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, " ; ")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1");
  const found: number[] = [];
  const add = (number: string, unit: string) => {
    const spec = units[unit.toLowerCase()];
    const amount = parseNumber(number, unit.toLowerCase());
    if (spec?.kind === kind && Number.isFinite(amount)) found.push(amount * spec.factor);
  };
  // {{converter|2521|mm|…}}, {{cvt|1105|-|1279|kg|…}}, {{convert|101|PS|…}}
  for (const [, inner] of text.matchAll(/\{\{\s*(?:converter|convert|cvt)\s*\|([^{}]*)\}\}/gi)) {
    const args = (inner ?? "").split("|").map((arg) => arg.trim());
    const unitIndex = args.findIndex((arg) => units[arg.toLowerCase()] !== undefined);
    if (unitIndex < 1) continue;
    const unit = args[unitIndex] ?? "";
    for (const arg of args.slice(0, unitIndex)) if (/^\d[\d.,]*$/.test(arg)) add(arg, unit);
  }
  // Plain text: "3.998 mm", "82 a 116 cv", "(72/77 cv)", "101 hp".
  const withoutTemplates = text.replace(/\{\{[^{}]*\}\}/g, " ");
  const number = String.raw`\d[\d.,]*`;
  const pattern = new RegExp(
    String.raw`(${number})(?:\s*(?:\/|a|to|–|-)\s*(${number}))?\s*(mm|cm|m|kg|t|lb|cv|ps|bhp|hp|kw)\b`,
    "gi",
  );
  for (const match of withoutTemplates.matchAll(pattern)) {
    const unit = match[3] ?? "";
    add(match[1] ?? "", unit);
    if (match[2]) add(match[2], unit);
  }
  return found;
}

/** Specs read from an article's wikitext; keys without a plausible value are left out. */
export function parseInfobox(wikitext: string): InfoboxSpecs {
  const fields = infoboxFields(wikitext);
  const values = new Map<keyof InfoboxSpecs, number[]>();
  // Power fields before the engine list, whatever their order in the infobox.
  const engineField = (name: string) => name === "motor" || name === "engine";
  const ordered = [...fields].sort(([a], [b]) => Number(engineField(a)) - Number(engineField(b)));
  for (const [name, value] of ordered) {
    const key = fieldKeys[name];
    if (!key) continue;
    // The power field wins over numbers fished out of the engine list.
    if ((name === "motor" || name === "engine") && values.has("power")) continue;
    const kind = key === "mass" ? "mass" : key === "power" ? "power" : "length";
    const [min, max] = limits[key];
    const list = quantities(value, kind).filter((amount) => amount >= min && amount <= max);
    if (list.length) values.set(key, [...(values.get(key) ?? []), ...list]);
  }
  const specs: InfoboxSpecs = {};
  for (const [key, list] of values) {
    const round = (value: number) =>
      key === "mass" || key === "power" ? Math.round(value) : Math.round(value * 1000) / 1000;
    specs[key] = [round(Math.min(...list)), round(Math.max(...list))];
  }
  return specs;
}

/** Without length and wheelbase when they cannot both be right (fields swapped in the article). */
function consistent(specs: InfoboxSpecs): InfoboxSpecs {
  const { length, wheelbase, ...rest } = specs;
  if (length && wheelbase && wheelbase[1] > length[1] * 0.75) return rest;
  return specs;
}

/** Wikidata first, then each article in order, key by key. */
export function mergeSpecs(...sources: (InfoboxSpecs | undefined)[]): InfoboxSpecs {
  const merged: InfoboxSpecs = {};
  for (const source of sources) {
    for (const [key, range] of Object.entries(consistent(source ?? {})) as [keyof InfoboxSpecs, SpecRange][]) {
      merged[key] ??= range;
    }
  }
  return merged;
}
