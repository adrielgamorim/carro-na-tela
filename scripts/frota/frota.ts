// Senatran fleet (Renavam open data): vehicles in circulation per state,
// city, "BRAND/MODEL" and year of manufacture. One monthly text file of about
// 1.2 GB; this module adds it up nationwide per brand/model and year.

/** data/frota/frota.json, written by npm run fetch:frota. */
export interface FleetFile {
  version: 1;
  generatedAt: string;
  /** "setembro de 2026" */
  reference: string;
  source: string;
  /** Renavam name ("CHEV/ONIX 10MT LT") → year of manufacture → vehicles. */
  models: Record<string, Record<string, number>>;
  /** Renavam name → state → vehicles (rows without a state count only nationwide). */
  states?: Record<string, Record<string, number>>;
}

// State names as the file writes them → abbreviation.
const stateCodes: Record<string, string> = {
  ACRE: "AC", ALAGOAS: "AL", AMAPA: "AP", AMAZONAS: "AM", BAHIA: "BA", CEARA: "CE",
  "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", GOIAS: "GO", MARANHAO: "MA",
  "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS", "MINAS GERAIS": "MG", PARA: "PA",
  PARAIBA: "PB", PARANA: "PR", PERNAMBUCO: "PE", PIAUI: "PI", "RIO DE JANEIRO": "RJ",
  "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS", RONDONIA: "RO", RORAIMA: "RR",
  "SANTA CATARINA": "SC", "SAO PAULO": "SP", SERGIPE: "SE", TOCANTINS: "TO",
};

const months = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "i_frota_por_uf_municipio_marca_e_modelo_ano_setembro_2026.zip" → 2026-09 sort key and label. */
export function fleetFileMonth(name: string): { key: string; label: string } | null {
  const match = /marca_e_modelo_ano_([a-zç]+)_(\d{4})\.zip$/i.exec(name);
  if (!match) return null;
  const month = months.indexOf((match[1] ?? "").toLowerCase().replace("ç", "c"));
  if (month < 0) return null;
  const label = month === 2 ? "março" : months[month];
  return { key: `${match[2]}-${String(month + 1).padStart(2, "0")}`, label: `${label} de ${match[2]}` };
}

/**
 * Adds up "UF;Município;Marca Modelo;Ano Fabricação;Qtd." lines (the header
 * and blank lines are skipped). Feed it text chunks in order.
 */
export function createFleetCounter() {
  const models = new Map<string, Map<string, number>>();
  const states = new Map<string, Map<string, number>>();
  let rest = "";
  let lines = 0;

  function addLine(line: string) {
    const fields = line.split(";");
    if (fields.length < 5) return;
    const name = (fields[2] ?? "").trim().replace(/\s+/g, " ");
    const year = (fields[3] ?? "").trim();
    const count = Number((fields[4] ?? "").trim());
    if (!name || !Number.isFinite(count) || count <= 0 || !/^\d{4}$/.test(year)) return;
    lines++;
    let years = models.get(name);
    if (!years) models.set(name, (years = new Map()));
    years.set(year, (years.get(year) ?? 0) + count);
    const state = stateCodes[(fields[0] ?? "").trim()];
    if (state) {
      let byState = states.get(name);
      if (!byState) states.set(name, (byState = new Map()));
      byState.set(state, (byState.get(state) ?? 0) + count);
    }
  }

  return {
    push(chunk: string) {
      const text = rest + chunk;
      const parts = text.split(/\r?\n/);
      rest = parts.pop() ?? "";
      for (const line of parts) addLine(line);
    },
    finish(): Record<string, Record<string, number>> {
      if (rest) addLine(rest);
      rest = "";
      const result: Record<string, Record<string, number>> = {};
      for (const [name, years] of [...models].sort(([a], [b]) => a.localeCompare(b))) {
        result[name] = Object.fromEntries([...years].sort(([a], [b]) => a.localeCompare(b)));
      }
      return result;
    },
    /** Per state, after finish(). */
    states(): Record<string, Record<string, number>> {
      return Object.fromEntries(
        [...states].map(([name, byState]) => [name, Object.fromEntries([...byState].sort())]),
      );
    },
    get lines() {
      return lines;
    },
  };
}
