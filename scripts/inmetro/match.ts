import type { InmetroSpec, PbevRow } from "../../src/catalog/inmetro.ts";
import type { ModelNameAttributes } from "../../src/catalog/modelName.ts";
import type { Propulsion } from "../../src/catalog/types.ts";

// Matches FIPE versions to PBEV rows. Names differ a lot between the two
// sources ("T CROSS" × "T-Cross 200 TSI", "C200" × "C-200 AMG Line"), so a
// match needs the same brand and model, no conflicting engine, transmission,
// fuel or propulsion, and then prefers rows sharing words of the version.

export interface FipeVersionForMatch {
  brand: string;
  model: string;
  fuel: string;
  propulsion: Propulsion;
  attributes: ModelNameAttributes;
}

const brandAliases: Record<string, string> = {
  VWVOLKSWAGEN: "VW",
  VOLKSWAGEN: "VW",
  GMCHEVROLET: "CHEVROLET",
  GM: "CHEVROLET",
  KIAMOTORS: "KIA",
  CAOACHERYCHERY: "CAOACHERY",
};

// Words that describe equipment rather than identify a model or version.
const genericWords = new Set([
  "4X2", "4X4", "A", "AT", "AUT", "AUTOMATICO", "CVT", "DIESEL", "EV", "FLEX",
  "HYBRID", "HIBRIDO", "M", "MEC", "MT", "TB", "TURBO",
]);

function words(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^A-Z0-9.]+/)
    .map((word) => word.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

const compact = (parts: string[]) => parts.join("").replace(/\./g, "");

export function brandKey(brand: string): string {
  const key = compact(words(brand));
  return brandAliases[key] ?? key;
}

/** How many characters of the PBEV model matched, or 0 when it does not. */
function modelMatch(fipeWords: string[], pbevModel: string): number {
  const modelWords = words(pbevModel);
  const target = compact(modelWords);
  // "T CROSS" = "T-Cross", "C200" = "C-200": the model is the start of the name.
  for (let count = 1; count <= Math.min(4, fipeWords.length); count += 1) {
    if (compact(fipeWords.slice(0, count)) === target) return target.length;
  }
  // "HILUX DIESEL 4X4 AT" ⊂ "Hilux CD SRX 4x4 2.8 TDI Diesel Aut.".
  const significant = modelWords.filter((word) => !genericWords.has(word));
  if (
    significant.length > 0 &&
    significant[0] === fipeWords[0] &&
    significant.every((word) => fipeWords.includes(word))
  ) {
    return compact(significant).length;
  }
  return 0;
}

function engineOf(engine: string) {
  const liters = /(\d)[.,](\d)/.exec(engine);
  const valves = /(\d+)\s*V\b/i.exec(engine);
  return {
    liters: liters ? Number(`${liters[1]}.${liters[2]}`) : undefined,
    valves: valves ? Number(valves[1]) : undefined,
  };
}

const propulsionFamily = (propulsion: Propulsion) =>
  propulsion === "hibrido-plugin" ? "hibrido" : propulsion;

/** Score of a candidate row, or null when something conflicts. */
function score(
  version: FipeVersionForMatch,
  fipeWords: string[],
  row: PbevRow,
): { score: number; versionWords: number; engineMatched: boolean } | null {
  if (propulsionFamily(version.propulsion) !== propulsionFamily(row.propulsion)) {
    return null;
  }
  const fipeDiesel = /diesel/i.test(version.fuel);
  if (row.fuel && fipeDiesel !== (row.fuel === "diesel")) return null;

  let total = 0;
  const engine = engineOf(row.engine);
  const { engineLiters, valves, transmission } = version.attributes;
  // Electric rows have no engine size; FIPE names without one cannot contradict.
  let engineMatched = row.propulsion === "eletrico" || engineLiters === undefined;
  if (engine.liters !== undefined && engineLiters !== undefined) {
    if (Math.abs(engine.liters - engineLiters) > 0.05) return null;
    total += 3;
    engineMatched = true;
  }
  // 8V and 16V versions of one size are different engines (and consumption).
  if (engine.valves !== undefined && valves !== undefined) {
    if (engine.valves !== valves) return null;
    total += 1;
  }
  // FIPE names often omit "turbo" (but never claim it falsely), and INMETRO
  // writes it many ways ("1.0T", "THP", "TSI"); diesels are all turbo. When a
  // model has both, follow the FIPE name.
  if (!fipeDiesel && row.propulsion !== "eletrico") {
    const rowTurbo = /\d[.,]\dT|\bT\b|TURBO|THP|TSI|TFSI|TDI|TGDI|\bTB\b/i.test(
      `${row.engine} ${row.version}`,
    );
    total += (version.attributes.aspiration === "turbo") === rowTurbo ? 1 : -2;
  }
  if (transmission && row.transmission) {
    if ((transmission === "manual") !== (row.transmission === "manual")) return null;
    total += transmission === row.transmission ? 2 : 1;
  }
  if (/flex/i.test(version.fuel) && row.fuel === "gasolina") total -= 1;

  const rowWords = words(row.version);
  // "RENEGADE LONGIT HYB" is a mild hybrid even when PBEV files it as
  // combustion; a FIPE version without hybrid in its name is not that one.
  if (
    version.propulsion === "combustao" &&
    rowWords.some((word) => /^(HYB|HYBRID|HEV|MHEV|PHEV)$/.test(word))
  ) {
    return null;
  }
  // Pickup cab codes are glued to the engine in PBEV ("CS13", "CD13").
  const rowCab = rowWords
    .map((word) => /^(CS|CD|CE)(?=\d|$)/.exec(word)?.[1])
    .find(Boolean);
  const cabs = { CS: "simples", CD: "dupla", CE: "estendida" } as const;
  if (rowCab && version.attributes.cab) {
    total += cabs[rowCab as keyof typeof cabs] === version.attributes.cab ? 2 : -3;
  }

  // Version words of the PBEV row found in the FIPE name ("COMFORTLINE",
  // "200TSI" in "200 TSI"), ignoring the model words and equipment words.
  const fipeCompact = compact(fipeWords);
  const modelWords = new Set(words(row.model));
  let versionWords = 0;
  for (const word of rowWords) {
    if (word.length < 2 || genericWords.has(word) || modelWords.has(word)) continue;
    if (/^\d+(\.\d+)?$/.test(word)) continue; // engine sizes are scored above
    if (fipeWords.includes(word) || fipeCompact.includes(word.replace(/\./g, ""))) {
      versionWords += 1;
    }
  }
  total += 2 * versionWords;

  return { score: total, versionWords, engineMatched };
}

export function createInmetroMatcher(rows: PbevRow[]) {
  const byBrand = new Map<string, PbevRow[]>();
  for (const row of rows) {
    const key = brandKey(row.brand);
    byBrand.set(key, [...(byBrand.get(key) ?? []), row]);
  }

  return function match(version: FipeVersionForMatch): InmetroSpec | null {
    const candidates = byBrand.get(brandKey(version.brand));
    if (!candidates) return null;
    const fipeWords = words(version.model);

    // Only rows of the longest matching model ("ONIX PLUS" over "ONIX").
    let bestModel = 0;
    const byModel = new Map<PbevRow, number>();
    for (const row of candidates) {
      const length = modelMatch(fipeWords, row.model);
      if (length > 0) byModel.set(row, length);
      bestModel = Math.max(bestModel, length);
    }
    if (bestModel === 0) return null;

    let best: { row: PbevRow; result: NonNullable<ReturnType<typeof score>> } | null = null;
    for (const [row, length] of byModel) {
      if (length !== bestModel) continue;
      const result = score(version, fipeWords, row);
      if (result && (!best || result.score > best.result.score)) best = { row, result };
    }
    if (!best) return null;

    const { brand: _brand, ...spec } = best.row;
    void _brand;
    return {
      ...spec,
      confidence:
        best.result.versionWords > 0 && best.result.engineMatched ? "exact" : "fuzzy",
    };
  };
}
