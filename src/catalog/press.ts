// Trunk volume and torque from carmakers' press releases (Stellantis Brasil's
// press room), reviewed by hand in data/imprensa and matched to the versions
// by line, model year and engine (scripts/imprensa/facts.ts).

export interface PressSource {
  url: string;
  title: string;
  /** Publication date, YYYY-MM-DD. */
  date: string;
}

export interface PressFigure {
  /** Liters (trunk) or kgfm (torque). */
  value: number;
  source: PressSource;
}

/** Figures of a spec sheet ("ficha técnica"); every field is optional (sheets vary). */
export interface SheetSpecs {
  powerCv?: number;
  /** kgfm, the higher of gasoline and ethanol. */
  torqueKgfm?: number;
  weightKg?: number;
  lengthMm?: number;
  /** Without mirrors. */
  widthMm?: number;
  heightMm?: number;
  wheelbaseMm?: number;
  groundClearanceMm?: number;
  trunkLiters?: number;
  tankLiters?: number;
  topSpeedKmh?: number;
  /** 0 to 100 km/h, the quicker of the fuels. */
  zeroTo100s?: number;
}

/** The carmaker's spec sheet of this very version and model year. */
export interface PressSheet {
  /** "Pulse Audace Turbo 200 Flex Automático". */
  title: string;
  /** The model-year page of the press room it is listed on. */
  page: string;
  specs: SheetSpecs;
  /** The press room ("Volkswagen", "Renault"); none for Stellantis'. */
  source?: string;
  /** The sheet's own file, for the press rooms that link it openly. */
  url?: string;
}

/** The release figures of a version-year, and its spec sheet. */
export interface PressSpecs {
  trunk?: PressFigure;
  torque?: PressFigure;
  sheet?: PressSheet;
}

const whole = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const tenths = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "370 litros" */
export const formatTrunk = (liters: number) => `${whole.format(liters)} litros`;

/** "20,4 kgfm (200 Nm)" */
export const formatTorque = (kgfm: number) => `${tenths.format(kgfm)} kgfm (${whole.format(kgfm * 9.80665)} Nm)`;

/** "4.095 mm", "1.234 kg", "189 km/h", "9,4 s": a spec sheet's exact figures. */
export const formatSheetValue = (value: number, unit: "mm" | "kg" | "km/h" | "s" | "litros" | "cv") =>
  `${(unit === "s" ? tenths : whole).format(value)} ${unit}`;

/** "out/2021", the month a release came out. */
export function releaseMonth(date: string): string {
  const [year, month] = date.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(month) - 1] ?? ""}/${year}`;
}
