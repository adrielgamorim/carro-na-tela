// Reading and summing SUSEP's AUTOSEG CASCO table (fetch-autoseg.ts): rows of
// tariff category, region, FIPE code, model year, sex and age band, with the
// exposure (vehicle-years), the premiums, the average insured value and the
// claims by cause.

/** One row of arq_casco_comp.csv. */
export interface AutosegRow {
  category: number;
  /** Region code: "11" is "SP - Met. de São Paulo". */
  region: string;
  /** FIPE code, "025081-3". */
  code: string;
  exposure: number;
  premium: number;
  insured: number;
  thefts: number;
}

/** SUSEP's regions by state (auto_reg.csv). */
const regionStates: Record<string, string> = {
  "01": "RS", "02": "RS", "03": "SC", "04": "SC", "05": "SC", "06": "PR", "07": "PR", "08": "PR",
  "09": "SP", "10": "SP", "11": "SP", "12": "SP", "13": "SP", "14": "MG", "15": "MG", "16": "MG",
  "17": "MG", "18": "RJ", "19": "RJ", "20": "ES", "21": "BA", "22": "SE", "23": "PE", "24": "PB",
  "25": "RN", "26": "AL", "27": "CE", "28": "PI", "29": "MA", "30": "PA", "31": "AM", "32": "AP",
  "33": "RO", "34": "RR", "35": "AC", "36": "MT", "37": "MS", "38": "DF", "39": "GO", "40": "TO",
  "41": "GO",
};

// Cars, imported cars, pickups and utility vehicles; not trucks, motorcycles or buses.
const carCategories = new Set([1, 2, 3, 7]);
const decimal = (text: string | undefined) => Number((text ?? "").replace(",", "."));

/** A row of the table ("COD_TARIF;REGIAO;COD_MODELO;ANO_MODELO;SEXO;IDADE;EXPOSICAO1;PREMIO1;…"), or none to skip. */
export function autosegRow(line: string): AutosegRow | undefined {
  const cells = line.split(";");
  const category = Number(cells[0]);
  if (!carCategories.has(category)) return undefined;
  const exposure = decimal(cells[6]);
  if (!(exposure > 0)) return undefined;
  return {
    category,
    region: cells[1]!.padStart(2, "0"),
    code: cells[2]!.trim(),
    exposure,
    premium: decimal(cells[7]),
    insured: decimal(cells[10]),
    thefts: decimal(cells[11]),
  };
}

export interface AutosegFile {
  period: string;
  source: string;
  /** Premium over insured value, per year, of all cars. */
  nationalRate: number;
  /** Thefts per thousand vehicle-years, of all cars. */
  nationalTheft: number;
  /** Each state's rate over the national one. */
  states: Record<string, number>;
  /** FIPE code → [vehicle-years, rate, thefts per thousand]. */
  models: Record<string, [number, number, number]>;
}

/** Below this many vehicle-years, a version's figures say too little. */
export const minExposure = 30;

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

/** The table summed by FIPE code and by state. */
export async function aggregateAutoseg(
  rows: AsyncIterable<AutosegRow> | Iterable<AutosegRow>,
  { period, source }: { period: string; source: string },
): Promise<AutosegFile> {
  type Sum = { exposure: number; premium: number; insured: number; thefts: number };
  const add = (sum: Sum, row: AutosegRow) => {
    sum.exposure += row.exposure;
    sum.premium += row.premium;
    // The insured value is an average over the row's exposure.
    sum.insured += row.insured * row.exposure;
    sum.thefts += row.thefts;
  };
  const empty = (): Sum => ({ exposure: 0, premium: 0, insured: 0, thefts: 0 });
  const byCode = new Map<string, Sum>();
  const byState = new Map<string, Sum>();
  const all = empty();
  for await (const row of rows) {
    if (!byCode.has(row.code)) byCode.set(row.code, empty());
    add(byCode.get(row.code)!, row);
    const state = regionStates[row.region];
    if (state) {
      if (!byState.has(state)) byState.set(state, empty());
      add(byState.get(state)!, row);
    }
    add(all, row);
  }
  const rate = (sum: Sum) => (sum.insured > 0 ? sum.premium / sum.insured : 0);
  const nationalRate = rate(all);
  const models: AutosegFile["models"] = {};
  for (const [code, sum] of [...byCode].sort(([a], [b]) => a.localeCompare(b))) {
    if (sum.exposure < minExposure || !(sum.insured > 0)) continue;
    models[code] = [Math.round(sum.exposure), round(rate(sum), 4), round((sum.thefts / sum.exposure) * 1000, 1)];
  }
  const states: Record<string, number> = {};
  for (const [state, sum] of [...byState].sort(([a], [b]) => a.localeCompare(b))) states[state] = round(rate(sum) / nationalRate, 3);
  return {
    period,
    source,
    nationalRate: round(nationalRate, 4),
    nationalTheft: round((all.thefts / all.exposure) * 1000, 1),
    states,
    models,
  };
}
