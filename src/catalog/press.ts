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

/** The release figures of a version-year. */
export interface PressSpecs {
  trunk?: PressFigure;
  torque?: PressFigure;
}

const whole = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const tenths = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "370 litros" */
export const formatTrunk = (liters: number) => `${whole.format(liters)} litros`;

/** "20,4 kgfm (200 Nm)" */
export const formatTorque = (kgfm: number) => `${tenths.format(kgfm)} kgfm (${whole.format(kgfm * 9.80665)} Nm)`;

/** "out/2021", the month a release came out. */
export function releaseMonth(date: string): string {
  const [year, month] = date.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(month) - 1] ?? ""}/${year}`;
}
