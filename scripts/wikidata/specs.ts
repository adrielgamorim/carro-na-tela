// Size and weight of car models from Wikidata: length, width, height,
// wheelbase and mass. Wikidata gives them per model line or generation, not
// per version, so they are approximate for a given FIPE version; a model with
// several values (variants, generations in one item) gets the range.

import type { ModelSpecs, SpecRange } from "../../src/catalog/wikidata.ts";

type SparqlRow = Record<string, { value: string } | undefined>;

// Wikidata property → spec, with the plausible range for a car (SI units: the
// query asks for the normalized amount, so "4070 mm" and "4.07 m" agree).
const properties: Record<string, { key: keyof ModelSpecs; min: number; max: number }> = {
  P2043: { key: "length", min: 2, max: 7 },
  P2049: { key: "width", min: 1.2, max: 2.7 },
  P2048: { key: "height", min: 0.9, max: 3.5 },
  P3039: { key: "wheelbase", min: 1.5, max: 4.8 },
  P2067: { key: "mass", min: 400, max: 6000 },
};

/** SPARQL for the normalized size and mass statements of the given items. */
export function specsQuery(ids: string[]): string {
  const pairs = Object.keys(properties)
    .map((property) => `(p:${property} psv:${property} "${property}")`)
    .join(" ");
  return `SELECT ?m ?property ?amount WHERE {
  VALUES ?m { ${ids.map((id) => `wd:${id}`).join(" ")} }
  VALUES (?p ?psv ?property) { ${pairs} }
  ?m ?p ?statement .
  ?statement ?psv ?value .
  ?value wikibase:quantityNormalized/wikibase:quantityAmount ?amount .
}`;
}

/** Rows of specsQuery → specs per item, dropping implausible values. */
export function parseSpecRows(rows: SparqlRow[]): Record<string, ModelSpecs> {
  const values = new Map<string, Map<keyof ModelSpecs, number[]>>();
  for (const row of rows) {
    const id = row.m?.value.split("/").pop();
    const spec = properties[row.property?.value ?? ""];
    const amount = Number(row.amount?.value);
    if (!id || !spec || !Number.isFinite(amount) || amount < spec.min || amount > spec.max) continue;
    const byKey = values.get(id) ?? new Map<keyof ModelSpecs, number[]>();
    byKey.set(spec.key, [...(byKey.get(spec.key) ?? []), amount]);
    values.set(id, byKey);
  }
  const specs: Record<string, ModelSpecs> = {};
  for (const [id, byKey] of [...values].sort(([a], [b]) => a.localeCompare(b))) {
    const entry: ModelSpecs = {};
    for (const [key, list] of byKey) {
      // Meters to the millimeter, kilograms to the kilogram.
      const round = (value: number) => (key === "mass" ? Math.round(value) : Math.round(value * 1000) / 1000);
      const range: SpecRange = [round(Math.min(...list)), round(Math.max(...list))];
      entry[key] = range;
    }
    specs[id] = entry;
  }
  return specs;
}
