// Figures computed from the others on the spec sheet: specific power and
// torque, weight per cv and per kgfm, and how far a full tank goes.

export interface DerivedInput {
  engineLiters?: number;
  powerCv?: number;
  torqueKgfm?: number;
  weightKg?: number;
  /** The weight is the model line's (Wikidata), not this version's. */
  weightApprox?: boolean;
  tankLiters?: number;
  /** km/l with gasoline (or the only fuel), INMETRO. */
  cityKmL?: number | null;
  highwayKmL?: number | null;
}

const tenths = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** The rows that can be worked out from what the sheet has, in display order. */
export function derivedSpecs(input: DerivedInput): [string, string][] {
  const { engineLiters, powerCv, torqueKgfm, weightKg, tankLiters, cityKmL, highwayKmL } = input;
  const approx = input.weightApprox ? "≈ " : "";
  const rows: [string, string][] = [];
  // Electric cars have no displacement; a liter figure would be nonsense.
  if (engineLiters && engineLiters > 0.5) {
    if (powerCv) rows.push(["Potência específica", `${tenths.format(powerCv / engineLiters)} cv/litro`]);
    if (torqueKgfm) rows.push(["Torque específico", `${tenths.format(torqueKgfm / engineLiters)} kgfm/litro`]);
  }
  if (weightKg) {
    if (powerCv) rows.push(["Peso/potência", `${approx}${tenths.format(weightKg / powerCv)} kg/cv`]);
    if (torqueKgfm) rows.push(["Peso/torque", `${approx}${tenths.format(weightKg / torqueKgfm)} kg/kgfm`]);
  }
  if (tankLiters) {
    if (cityKmL) rows.push(["Autonomia na cidade", `≈ ${whole.format(tankLiters * cityKmL)} km`]);
    if (highwayKmL) rows.push(["Autonomia na estrada", `≈ ${whole.format(tankLiters * highwayKmL)} km`]);
  }
  return rows;
}
