import { requestJson } from "./http";
import type { RequestOptions } from "./http";

// NHTSA vPIC (free, no key, CORS open) decodes VINs of vehicles sold in the
// United States: imports built there, in Mexico, Japan, Korea or Germany often
// come back with model, body and engine. Brazilian chassis rarely do (most
// local makers are not registered with NHTSA), so this only complements
// catalog/vin.ts.

export interface VpicVehicle {
  make: string;
  model: string;
  modelYear: number | null;
  trim?: string;
  bodyClass?: string;
  fuel?: string;
  /** Liters, one decimal. */
  displacement?: number;
  plant?: string;
}

type VpicValues = Record<string, string | null>;

const baseUrl = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

function value(values: VpicValues, key: string): string | undefined {
  const text = values[key]?.trim();
  return text && text !== "Not Applicable" ? text : undefined;
}

/** Title case for vPIC's upper-case makes ("MERCEDES-BENZ" → "Mercedes-Benz"). */
function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
}

/** Turns one vPIC result row into a vehicle, or null when it has no model. */
export function parseVpicValues(values: VpicValues): VpicVehicle | null {
  const make = value(values, "Make");
  const model = value(values, "Model");
  if (!make || !model) return null;
  const year = Number(value(values, "ModelYear"));
  const liters = Number(value(values, "DisplacementL"));
  // "UNITED STATES (USA)" → "United States"
  const country = value(values, "PlantCountry")?.replace(/\s*\(.*\)$/, "");
  const plant = [value(values, "PlantCity"), country]
    .filter(Boolean)
    .map((part) => titleCase(part!))
    .join(", ");
  return {
    make: titleCase(make),
    model,
    modelYear: Number.isInteger(year) && year > 1900 ? year : null,
    trim: value(values, "Trim"),
    bodyClass: value(values, "BodyClass"),
    fuel: value(values, "FuelTypePrimary"),
    displacement: liters > 0 ? Math.round(liters * 10) / 10 : undefined,
    plant: plant || undefined,
  };
}

export async function decodeVinWithVpic(
  vin: string,
  options: RequestOptions = {},
): Promise<VpicVehicle | null> {
  const response = await requestJson<{ Results?: VpicValues[] }>(
    "NHTSA vPIC",
    `${baseUrl}/${encodeURIComponent(vin)}?format=json`,
    { timeoutMs: 10_000, ...options },
  );
  const values = response.Results?.[0];
  return values ? parseVpicValues(values) : null;
}
