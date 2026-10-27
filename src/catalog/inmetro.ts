// INMETRO PBEV (Programa Brasileiro de Etiquetagem Veicular) data attached to
// catalog versions. Dependency-free types so scripts and the app share them.

import type { BodyHint, Transmission } from "./modelName.ts";
import type { Propulsion } from "./types.ts";

export type SizeClass =
  | "subcompacto"
  | "compacto"
  | "medio"
  | "grande"
  | "extra-grande";

export type Steering = "hidraulica" | "mecanica" | "eletrica" | "eletro-hidraulica";

/** km/l (km/l equivalente for electric driving); null when not applicable. */
export interface InmetroConsumption {
  ethanolCity: number | null;
  ethanolHighway: number | null;
  /** Gasoline or diesel, depending on the fuel. */
  fuelCity: number | null;
  fuelHighway: number | null;
  electricCity: number | null;
  electricHighway: number | null;
}

/** One row of the PBEV table, normalized. */
export interface PbevRow {
  table: number;
  category: string;
  brand: string;
  model: string;
  version: string;
  engine: string;
  size: SizeClass | null;
  body: BodyHint | null;
  fourWheelDrive: boolean;
  propulsion: Propulsion;
  fuel: "etanol" | "gasolina" | "flex" | "diesel" | "eletrico" | null;
  transmission: Transmission | null;
  gears: number | null;
  airConditioning: boolean | null;
  steering: Steering | null;
  consumption: InmetroConsumption;
  /** Electric range in km (electric and plug-in hybrids). */
  rangeKm: number | null;
  /** Energy use in MJ/km ("Consumo energético"), for any propulsion. */
  energyMjKm: number | null;
}

/** PBEV data matched to a FIPE version. */
export interface InmetroSpec extends Omit<PbevRow, "brand"> {
  /** "exact" when version words matched too, "fuzzy" on model and engine only. */
  confidence: "exact" | "fuzzy";
}
