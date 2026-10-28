import type { FipeVehicle } from "../types/vehicle";
import type { Origin } from "./fleet";
import type { SizeClass, Steering } from "./inmetro";
import type { BodyHint, CabType, Transmission } from "./modelName";
import type { CatalogEntry, Propulsion } from "./types";

export const propulsionLabels: Record<Propulsion, string> = {
  combustao: "Combustão",
  hibrido: "Híbrido",
  "hibrido-plugin": "Híbrido plug-in",
  eletrico: "Elétrico",
};

export const transmissionLabels: Record<Transmission, string> = {
  manual: "Manual",
  automatico: "Automático",
  cvt: "CVT",
  dct: "Dupla embreagem",
  automatizado: "Automatizado",
};

export const bodyLabels: Record<BodyHint, string> = {
  hatch: "Hatch",
  suv: "SUV",
  minivan: "Minivan",
  sedan: "Sedã",
  perua: "Perua",
  cupe: "Cupê",
  conversivel: "Conversível",
  picape: "Picape",
  furgao: "Furgão",
  van: "Van",
  "chassi-cabine": "Chassi-cabine",
};

export const cabLabels: Record<CabType, string> = {
  simples: "cabine simples",
  dupla: "cabine dupla",
  estendida: "cabine estendida",
};

export function yearLabel(entry: CatalogEntry): string {
  return entry.zeroKm ? "0 km" : String(entry.modelYear);
}

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return compactCurrency.format(value);
}

export const sizeLabels: Record<SizeClass, string> = {
  subcompacto: "Subcompacto",
  compacto: "Compacto",
  medio: "Médio",
  grande: "Grande",
  "extra-grande": "Extra grande",
};

export const originLabels: Record<Origin, string> = {
  nacional: "Nacional",
  importado: "Importado",
};

export const steeringLabels: Record<Steering, string> = {
  eletrica: "Elétrica",
  "eletro-hidraulica": "Eletro-hidráulica",
  hidraulica: "Hidráulica",
  mecanica: "Mecânica",
};

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function formatKmL(value: number): string {
  return `${decimal.format(value)} km/l`;
}

export function transmissionLabel(entry: CatalogEntry): string | null {
  if (!entry.transmission) return null;
  const label = transmissionLabels[entry.transmission];
  return entry.gears ? `${label} ${entry.gears}m` : label;
}

export function engineLabel(entry: CatalogEntry): string | null {
  const { attributes } = entry;
  const label = [
    attributes.engineLiters?.toFixed(1),
    attributes.aspiration === "turbo" ? "turbo" : undefined,
    attributes.aspiration === "compressor" ? "compressor" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  return label || null;
}

export function bodyLabel(entry: CatalogEntry): string | null {
  if (!entry.bodyType) return null;
  const cab = entry.attributes.cab;
  return cab
    ? `${bodyLabels[entry.bodyType]}, ${cabLabels[cab]}`
    : bodyLabels[entry.bodyType];
}

/** Attribute tags shown on a catalog card, most useful first. */
export function entryTags(entry: CatalogEntry): string[] {
  const { attributes } = entry;
  const tags: string[] = [propulsionLabels[entry.propulsion]];

  if (entry.propulsion === "combustao" || entry.propulsion === "hibrido") {
    tags.push(entry.fuel);
  }
  const engine = engineLabel(entry);
  if (engine) tags.push(engine);
  if (attributes.powerCv) tags.push(`${attributes.powerCv} cv`);
  const transmission = transmissionLabel(entry);
  if (transmission) tags.push(transmission);
  if (attributes.fourWheelDrive || entry.inmetro?.fourWheelDrive) tags.push("4x4");
  const body = bodyLabel(entry);
  if (body) tags.push(body);
  if (entry.size) tags.push(`Porte ${sizeLabels[entry.size].toLowerCase()}`);
  if (attributes.doors) tags.push(`${attributes.doors} portas`);
  if (entry.cityKmL !== null) tags.push(`${formatKmL(entry.cityKmL)} cidade`);
  return [...new Set(tags)];
}

/**
 * Same shape and id as a vehicle consulted through the live FIPE search, or
 * null while the entry has no crawled price.
 */
export function catalogEntryToVehicle(entry: CatalogEntry): FipeVehicle | null {
  if (entry.priceValue === null || entry.price === null || !entry.codeFipe) {
    return null;
  }
  return {
    id: `${entry.category}:${entry.referenceCode}:${entry.codeFipe}:${entry.yearCode}`,
    category: entry.category,
    yearCode: entry.yearCode,
    // FIPE's own name: the vehicle is looked up and stored like a consulted one.
    brand: entry.fipeBrand,
    model: entry.model,
    codeFipe: entry.codeFipe,
    fuel: entry.fuel,
    fuelAcronym: entry.fuel.charAt(0).toUpperCase(),
    modelYear: entry.zeroKm ? 32000 : (entry.modelYear ?? 0),
    price: entry.price,
    priceValue: entry.priceValue,
    referenceMonth: entry.referenceMonth ?? "",
    referenceCode: entry.referenceCode,
  };
}
