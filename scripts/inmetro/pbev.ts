import type { PbevRow, SizeClass, Steering } from "../../src/catalog/inmetro.ts";
import type { BodyHint, Transmission } from "../../src/catalog/modelName.ts";
import type { Propulsion } from "../../src/catalog/types.ts";

// Parses the INMETRO PBEV tables (PDFs exported from Excel, one per year).
// Cells are centered in fixed columns, so each text item goes to the column
// whose center is nearest. Columns move every year, so each year has its own
// layout. Long cells wrap into extra lines a few points away; those lines are
// merged into the nearest data row. Some years print the table rotated 90°:
// the reader (parse-pbev.ts) swaps the axes, so here every table reads the
// same way: rows top to bottom (higher `y` first), columns by `center`.

export interface PdfTextCell {
  /** Center of the text item along the table's columns. */
  center: number;
  /** Its width along them, to tell words of one cell from neighboring cells. */
  width?: number;
  text: string;
}

export interface PdfTextLine {
  page: number;
  /** Row position; higher comes first in the table. */
  y: number;
  cells: PdfTextCell[];
}

export type Column =
  | "category"
  | "brand"
  | "model"
  | "version"
  | "engine"
  | "propulsion"
  | "transmission"
  | "airConditioning"
  | "steering"
  | "fuel"
  | "ethanolCity"
  | "ethanolHighway"
  | "fuelCity"
  | "fuelHighway"
  | "electricCity"
  | "electricHighway"
  | "energyMjKm"
  | "rangeKm";

export interface PbevLayout {
  /**
   * Column centers in points. Two centers for one column (engine "1.0" | "8V",
   * transmission "M" | "5") are read as parts and joined with a space.
   */
  columns: Partial<Record<Column, number | number[]>>;
  /** Tables without electric columns (2022 and earlier) put km/le in the fuel columns. */
  electricInFuelColumns?: boolean;
  /** Wider match for columns whose parts shift (2020's engine: "1.0" | "12V Turbo"). */
  tolerances?: Partial<Record<Column, number>>;
}

/** Measured on each year's PDF (2009 is left out: two methodologies per cell). */
export const pbevLayouts: Record<number, PbevLayout> = {
  2010: {
    columns: {
      brand: 70, model: 127, version: 199, engine: 267, transmission: 334,
      airConditioning: 398, steering: 465, fuel: 543,
      ethanolCity: 594, fuelCity: 637, ethanolHighway: 679, fuelHighway: 722,
    },
  },
  2011: {
    columns: {
      brand: 58, model: 117, version: 205, engine: 287, transmission: 354,
      airConditioning: 418, steering: 485, fuel: 563,
      ethanolCity: 614, fuelCity: 657, ethanolHighway: 699, fuelHighway: 742,
    },
  },
  2012: {
    columns: {
      brand: 51, model: 113, version: 204, engine: 286, transmission: 352,
      airConditioning: 417, steering: 484, fuel: 562,
      ethanolCity: 613, fuelCity: 656, ethanolHighway: 698, fuelHighway: 741,
    },
  },
  2013: {
    columns: {
      category: 45, brand: 96, model: 152, engine: [189, 200], version: 235,
      transmission: [282, 289], airConditioning: 318, steering: 344, fuel: 381,
      ethanolCity: 583, ethanolHighway: 608, fuelCity: 633, fuelHighway: 658, energyMjKm: 689,
    },
  },
  2014: {
    columns: {
      category: 45, brand: 96, model: 155, engine: [196, 207], version: 239,
      transmission: [283, 290], airConditioning: 318, steering: 345, fuel: 381,
      ethanolCity: 581, ethanolHighway: 606, fuelCity: 631, fuelHighway: 655, energyMjKm: 686,
    },
  },
  2015: {
    columns: {
      category: 45, brand: 96, model: 154, engine: [194, 205], version: 237,
      transmission: [281, 289], airConditioning: 317, steering: 343, fuel: 379,
      ethanolCity: 581, ethanolHighway: 605, fuelCity: 630, fuelHighway: 655, energyMjKm: 686,
    },
  },
  2016: {
    columns: {
      category: 43, brand: 90, model: 173, engine: [239, 250], version: 281,
      transmission: [322, 329], airConditioning: 355, steering: 379, fuel: 413,
      ethanolCity: 599, ethanolHighway: 622, fuelCity: 645, fuelHighway: 667, energyMjKm: 696,
    },
  },
  2017: { columns: layout2017to2019() },
  2018: { columns: layout2017to2019() },
  2019: { columns: layout2017to2019() },
  2020: {
    columns: {
      category: 43, brand: 92, model: 152, engine: [208, 219], version: 266,
      transmission: [310, 316], airConditioning: 343, steering: 368, fuel: 403,
      ethanolCity: 593, ethanolHighway: 617, fuelCity: 640, fuelHighway: 664, energyMjKm: 693,
    },
    tolerances: { engine: 12 },
  },
  2021: {
    columns: {
      category: 63, brand: 112, model: 167, version: 230, engine: 274, transmission: 306,
      airConditioning: 333, steering: 357, propulsion: 392, fuel: 430,
      ethanolCity: 599, ethanolHighway: 621, fuelCity: 642, fuelHighway: 664, energyMjKm: 689,
    },
  },
  2022: {
    columns: {
      category: 55, brand: 87, model: 118, version: 157, engine: 185, propulsion: 205,
      transmission: 229, airConditioning: 248, steering: 265, fuel: 285,
      ethanolCity: 397, ethanolHighway: 412, fuelCity: 426, fuelHighway: 440, energyMjKm: 458,
    },
  },
  2023: {
    columns: {
      category: 65, brand: 110, model: 149, version: 203, engine: 249.5, propulsion: 277,
      transmission: 309, airConditioning: 337, steering: 357, fuel: 383,
      ethanolCity: 542, ethanolHighway: 561, fuelCity: 580, fuelHighway: 600,
      electricCity: 620, electricHighway: 641, energyMjKm: 664, rangeKm: 691,
    },
  },
  2024: {
    columns: {
      category: 47, brand: 93, model: 132, version: 185.5, engine: 231, propulsion: 257,
      transmission: 284, airConditioning: 306, steering: 326, fuel: 352,
      ethanolCity: 512, ethanolHighway: 528, fuelCity: 545, fuelHighway: 561,
      electricCity: 581, electricHighway: 607, energyMjKm: 631, rangeKm: 654,
    },
  },
  2025: {
    columns: {
      category: 48, brand: 97, model: 138, version: 184, engine: 219, propulsion: 244,
      transmission: 272, airConditioning: 295, steering: 312, fuel: 336,
      ethanolCity: 514, ethanolHighway: 531, fuelCity: 548, fuelHighway: 565,
      electricCity: 585, electricHighway: 609, energyMjKm: 635, rangeKm: 659,
    },
  },
  2026: {
    columns: {
      category: 185, brand: 218.5, model: 250, version: 283, engine: 305, propulsion: 320,
      transmission: 337, airConditioning: 350, steering: 363.5, fuel: 380,
      ethanolCity: 477, ethanolHighway: 487, fuelCity: 511, fuelHighway: 521,
      electricCity: 546, electricHighway: 558, energyMjKm: 594, rangeKm: 610,
    },
  },
};

function layout2017to2019(): PbevLayout["columns"] {
  return {
    category: 56, brand: 102, model: 146, version: 204, engine: 256, transmission: 288,
    airConditioning: 319, steering: 346, fuel: 381,
    ethanolCity: 570, ethanolHighway: 594, fuelCity: 619, fuelHighway: 643, energyMjKm: 671,
  };
}

// Tables up to 2022 have no electric columns: electric cars use the fuel ones.
for (const [year, layout] of Object.entries(pbevLayouts)) {
  if (Number(year) <= 2022) layout.electricInFuelColumns = true;
}

/** Kept for the 2026 tests and callers that only need that year. */
// The 2026 layout is defined above.
export const pbevColumns = pbevLayouts[2026]!.columns as Record<Column, number>;

// A cell belongs to a column only this close to its center; everything else
// (emissions, ratings…) is ignored.
const maxDistance = 4;
// Wrapped parts of a cell sit this close to their row.
const wrapDistance = 4;

const categories: Record<string, { size: SizeClass | null; body: BodyHint | null }> = {
  "sub compacto": { size: "subcompacto", body: null },
  subcompacto: { size: "subcompacto", body: null },
  compacto: { size: "compacto", body: null },
  medio: { size: "medio", body: null },
  grande: { size: "grande", body: null },
  "extra grande": { size: "extra-grande", body: null },
  "utilitario esportivo compacto": { size: "compacto", body: "suv" },
  "utilitario esportivo grande": { size: "grande", body: "suv" },
  "fora de estrada compacto": { size: "compacto", body: "suv" },
  "fora de estrada grande": { size: "grande", body: "suv" },
  "fora de estrada": { size: null, body: "suv" },
  minivan: { size: null, body: "minivan" },
  comercial: { size: null, body: null },
  "picape compacta": { size: "compacto", body: "picape" },
  picape: { size: null, body: "picape" },
  esportivo: { size: null, body: null },
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseCategory(category: string) {
  const key = normalize(category).replace(/ 4x4$/, "");
  return {
    known: key in categories,
    fourWheelDrive: /4x4$/i.test(category.trim()),
    ...(categories[key] ?? { size: null, body: null }),
  };
}

/** "9,8" and "9.8" (2024–2025 use a decimal point) and "1.234,5". */
export function parseNumber(text: string | undefined): number | null {
  if (!text || !/\d/.test(text)) return null;
  const cleaned = text.trim();
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const propulsions: Record<string, Propulsion> = {
  combustao: "combustao",
  hibrido: "hibrido",
  "plug-in": "hibrido-plugin",
  eletrico: "eletrico",
};

/** Tables before 2021 have no propulsion column; read it from the names. */
function guessPropulsion(cells: Map<Column, string>): Propulsion {
  const text = normalize(
    `${cells.get("model") ?? ""} ${cells.get("version") ?? ""} ${cells.get("engine") ?? ""}`,
  );
  if (/\b(phev|plug-in|plug in)\b/.test(text)) return "hibrido-plugin";
  if (/\b(eletrico|ev)\b/.test(text) && !/\d\.\d/.test(cells.get("engine") ?? "")) {
    return "eletrico";
  }
  if (/\b(hybrid|hibrido|hev)\b/.test(text)) return "hibrido";
  return "combustao";
}

// The table mixes notations: "M-5", "A - 8", "CVT 9", "(CVT) CVT", "eCVT",
// "AT"/"MT", "DTC - 7" (typo for DCT) and "DHT-2" (hybrid dedicated
// transmission, an automatic).
const transmissionKinds: Record<string, Transmission> = {
  M: "manual",
  MT: "manual",
  A: "automatico",
  AT: "automatico",
  DHT: "automatico",
  CVT: "cvt",
  ECVT: "cvt",
  DCT: "dct",
  DTC: "dct",
  MTA: "automatizado",
};

export function parseTransmission(text: string): {
  transmission: Transmission | null;
  gears: number | null;
} {
  const cleaned = text.toUpperCase().replace(/\([^)]*\)/g, "").trim();
  const kind = /^(ECVT|CVT|DCT|DTC|DHT|MTA|AT|MT|M|A)\b/.exec(cleaned)?.[1];
  if (!kind) return { transmission: null, gears: null };
  const gears = Number(/(\d+)\s*$/.exec(cleaned)?.[1] ?? Number.NaN);
  return {
    transmission: transmissionKinds[kind] ?? null,
    // Single-speed (electric) reductions are not "gears" for filtering.
    gears: gears > 1 ? gears : null,
  };
}

const steerings: Record<string, Steering> = {
  H: "hidraulica",
  M: "mecanica",
  E: "eletrica",
  "E-H": "eletro-hidraulica",
  EH: "eletro-hidraulica",
};

const fuels: Record<string, NonNullable<PbevRow["fuel"]>> = {
  A: "etanol",
  E: "etanol",
  E100: "etanol",
  G: "gasolina",
  F: "flex",
  D: "diesel",
};

/** Column (and part, for split columns) nearest to a cell. */
function columnOf(
  center: number,
  layout: PbevLayout,
): { column: Column; part: number } | null {
  let best: { column: Column; part: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [column, centers] of Object.entries(layout.columns) as [Column, number | number[]][]) {
    const tolerance = layout.tolerances?.[column] ?? maxDistance;
    (Array.isArray(centers) ? centers : [centers]).forEach((columnCenter, part) => {
      const distance = Math.abs(center - columnCenter);
      if (distance <= tolerance && distance < bestDistance) {
        best = { column, part };
        bestDistance = distance;
      }
    });
  }
  return best;
}

const headerWords = /^(marca|modelo|fabricante|categoria|versao)$/;

interface ParsedRow {
  page: number;
  y: number;
  cells: Map<Column, string>;
}

/** Groups wrapped lines with their row and returns each row's cells by column. */
export function groupPbevRows(lines: PdfTextLine[], layout: PbevLayout): ParsedRow[] {
  const cellText = (line: PdfTextLine, column: Column) =>
    line.cells.find((cell) => columnOf(cell.center, layout)?.column === column)?.text.trim();
  // A data row has a brand and a model (headers repeat the column names).
  const isRowStart = (line: PdfTextLine) => {
    const brand = cellText(line, "brand");
    const model = cellText(line, "model");
    return Boolean(brand && model && !headerWords.test(normalize(brand)) && line.cells.length >= 5);
  };

  const rows = lines
    .filter(isRowStart)
    .map((line) => ({ line, parts: [line] }));
  for (const line of lines) {
    if (isRowStart(line)) continue;
    let nearest: (typeof rows)[number] | undefined;
    for (const row of rows) {
      if (row.line.page !== line.page) continue;
      const distance = Math.abs(row.line.y - line.y);
      if (distance <= wrapDistance && (!nearest || distance < Math.abs(nearest.line.y - line.y))) {
        nearest = row;
      }
    }
    nearest?.parts.push(line);
  }

  return rows.map(({ line, parts }) => {
    const pieces = new Map<Column, { part: number; text: string }[]>();
    // Top line first, as the text reads.
    for (const piece of [...parts].sort((a, b) => b.y - a.y)) {
      for (const cell of piece.cells) {
        const target = columnOf(cell.center, layout);
        const text = cell.text.trim();
        if (!target || !text) continue;
        pieces.set(target.column, [...(pieces.get(target.column) ?? []), { part: target.part, text }]);
      }
    }
    const cells = new Map<Column, string>();
    for (const [column, texts] of pieces) {
      const joined = [...texts]
        .sort((a, b) => a.part - b.part)
        .map((piece) => piece.text)
        .join(" ")
        .replace(/\s+/g, " ");
      cells.set(column, joined);
    }
    return { page: line.page, y: line.y, cells };
  });
}

/**
 * Older tables print the category once per group (a merged cell). Rows are
 * sorted by brand within each category, so a new group starts where the
 * brand order restarts; each group takes the category label inside it.
 */
function fillMergedCategories(rows: ParsedRow[], lines: PdfTextLine[], layout: PbevLayout) {
  if (layout.columns.category === undefined) return;
  const order = (page: number, y: number) => page * 100_000 - y;
  const sorted = [...rows].sort((a, b) => order(a.page, a.y) - order(b.page, b.y));

  const groups: ParsedRow[][] = [];
  let previousBrand = "";
  let groupCategory: string | undefined;
  for (const row of sorted) {
    const brand = normalize(row.cells.get("brand") ?? "");
    const own = row.cells.get("category");
    const brandRestarts = brand.localeCompare(previousBrand, "pt-BR") < 0;
    const categoryChanges = Boolean(own && groupCategory && own !== groupCategory);
    if (groups.length === 0 || brandRestarts || categoryChanges) {
      groups.push([]);
      groupCategory = undefined;
    }
    groups.at(-1)!.push(row);
    groupCategory ??= own;
    previousBrand = brand;
  }

  const labels = lines.flatMap((line) =>
    line.cells
      .filter((cell) => columnOf(cell.center, layout)?.column === "category" && parseCategory(cell.text).known)
      .map((cell) => ({ key: order(line.page, line.y), text: cell.text.trim() })),
  );

  for (const group of groups) {
    const head = group[0];
    const tail = group.at(-1);
    if (!head || !tail) continue;
    const first = order(head.page, head.y);
    const last = order(tail.page, tail.y);
    const own = group.map((row) => row.cells.get("category")).find(Boolean);
    const label =
      own ?? labels.find((item) => item.key >= first - wrapDistance * 2 && item.key <= last + wrapDistance * 2)?.text;
    if (!label) continue;
    for (const row of group) {
      if (!row.cells.get("category")) row.cells.set("category", label);
    }
  }
}

export function toPbevRow(
  cells: Map<Column, string>,
  table: number,
  layout: PbevLayout = pbevLayouts[table] ?? pbevLayouts[2026]!,
): PbevRow | null {
  const brand = cells.get("brand");
  const model = cells.get("model");
  if (!brand || !model) return null;
  // Title lines ("Tabela Ano | 2026") land in the brand and model columns too.
  if (!cells.get("engine") && !cells.get("fuel") && !cells.get("transmission")) return null;

  const category = cells.get("category") ?? "";
  const { size, body, fourWheelDrive } = parseCategory(category);
  const propulsion =
    layout.columns.propulsion === undefined
      ? guessPropulsion(cells)
      : (propulsions[normalize(cells.get("propulsion") ?? "")] ?? "combustao");
  const fuelCode = (cells.get("fuel") ?? "").toUpperCase().replace(/\s/g, "");
  const airConditioning = (cells.get("airConditioning") ?? "").toUpperCase();
  const number = (column: Column) => parseNumber(cells.get(column));
  const consumption = {
    ethanolCity: number("ethanolCity"),
    ethanolHighway: number("ethanolHighway"),
    fuelCity: number("fuelCity"),
    fuelHighway: number("fuelHighway"),
    electricCity: number("electricCity"),
    electricHighway: number("electricHighway"),
  };
  if (layout.electricInFuelColumns && propulsion === "eletrico") {
    consumption.electricCity ??= consumption.fuelCity;
    consumption.electricHighway ??= consumption.fuelHighway;
    consumption.fuelCity = null;
    consumption.fuelHighway = null;
  }
  // A garbled row must not become data: drop values no car reaches.
  const plausible = (value: number | null, min: number, max: number) =>
    value !== null && value >= min && value <= max ? value : null;
  for (const key of ["ethanolCity", "ethanolHighway", "fuelCity", "fuelHighway"] as const) {
    consumption[key] = plausible(consumption[key], 2.5, 50);
  }
  for (const key of ["electricCity", "electricHighway"] as const) {
    consumption[key] = plausible(consumption[key], 10, 200);
  }

  return {
    table,
    category: category.replace(/\s+/g, " "),
    brand,
    model,
    version: cells.get("version") ?? "",
    engine: cells.get("engine") ?? "",
    size,
    body,
    fourWheelDrive,
    propulsion,
    // The fuel column says "E" for electric cars too.
    fuel: propulsion === "eletrico" ? "eletrico" : (fuels[fuelCode] ?? null),
    ...parseTransmission(cells.get("transmission") ?? ""),
    airConditioning:
      airConditioning === "S" || airConditioning === "SIM"
        ? true
        : airConditioning === "N" || airConditioning === "NAO" || airConditioning === "NÃO"
          ? false
          : null,
    steering: steerings[(cells.get("steering") ?? "").toUpperCase().replace(/\s/g, "")] ?? null,
    consumption,
    rangeKm: number("rangeKm"),
    energyMjKm: number("energyMjKm"),
  };
}

export function parsePbevLines(lines: PdfTextLine[], table: number): PbevRow[] {
  const layout = pbevLayouts[table];
  if (!layout) throw new Error(`Sem layout para a tabela PBEV ${table}`);
  const rows = groupPbevRows(lines, layout);
  fillMergedCategories(rows, lines, layout);
  return rows
    .map((row) => toPbevRow(row.cells, table, layout))
    .filter((row): row is PbevRow => row !== null);
}
