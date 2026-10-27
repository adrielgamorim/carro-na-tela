// Wire format of public/catalog/index.json and its expansion into entries.
// One row per FIPE version (brand + model code) with its years nested, and
// brand/fuel names in lookup tables, keeps the full catalog to a few MB.

import { getModelFamily } from "../services/fipeParsing.ts";
import type { InmetroSpec } from "./inmetro.ts";
import { versionDepreciation } from "./depreciation.ts";
import type { CatalogFleetInfo, CatalogFleetLine } from "./fleet.ts";
import { fleetOrigin } from "./fleet.ts";
import type { CatalogModelInfo } from "./wikidata.ts";
import type { ModelNameAttributes } from "./modelName.ts";
import type {
  CatalogEntry,
  CatalogIndex,
  CatalogSnapshotInfo,
  Propulsion,
} from "./types.ts";

export interface WireVersion {
  /** Index into `snapshots`. */
  s: number;
  /** Index into `brands`. */
  b: number;
  /** FIPE model code. */
  m: string;
  /** Model name. */
  n: string;
  /** Code FIPE, once any year of the version was priced. */
  f?: string;
  /** Attributes parsed from the name; omitted when empty. */
  a?: ModelNameAttributes;
  /** [yearCode, price in BRL or null], newest first. */
  y: [string, number | null][];
  /** INMETRO PBEV data matched to this version. */
  i?: InmetroSpec;
  /** Index into `models`: the Wikidata model line matched by name. */
  w?: number;
  /** Index into `fleet.lines`: the model line's fleet (Senatran). */
  p?: number;
}

export interface CatalogIndexFile {
  version: 2;
  generatedAt: string;
  snapshots: CatalogSnapshotInfo[];
  brands: { code: string; name: string }[];
  /** Fuel code (suffix of the year code) → label, e.g. "5" → "Flex". */
  fuels: Record<string, string>;
  versions: WireVersion[];
  /** Wikidata model lines referenced by `WireVersion.w`. */
  models?: CatalogModelInfo[];
  /** Fleet in circulation per model line (npm run fetch:frota), ranked. */
  fleet?: {
    reference: string;
    source: string;
    /** Lines ranked in the whole catalog, when `lines` is a subset (brand slices). */
    lineCount?: number;
    lines: CatalogFleetLine[];
  };
}

export function derivePropulsion(
  fuel: string,
  attributes: ModelNameAttributes,
): Propulsion {
  if (attributes.propulsion) return attributes.propulsion;

  const normalized = fuel.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (normalized.includes("eletric")) return "eletrico";
  if (normalized.includes("hibrid")) return "hibrido";
  return "combustao";
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function formatFipePrice(value: number): string {
  // FIPE writes "R$ 98.990,00" with a plain space.
  return currency.format(value).replace(/\s/g, " ");
}

export function expandCatalogIndex(file: CatalogIndexFile): CatalogIndex {
  const entries: CatalogEntry[] = [];

  for (const version of file.versions) {
    const snapshot = file.snapshots[version.s];
    const brand = file.brands[version.b];
    const inmetro = version.i ?? null;
    // Some FIPE names omit the engine size ("PULSE AUDACE Turbo 200");
    // INMETRO writes it as "1.0T-12V".
    const pbevLiters = /(\d)[.,](\d)/.exec(inmetro?.engine ?? "");
    const attributes =
      version.a?.engineLiters === undefined && pbevLiters
        ? { ...version.a, engineLiters: Number(`${pbevLiters[1]}.${pbevLiters[2]}`) }
        : (version.a ?? {});
    const family = getModelFamily(version.n);
    const fleetLine = version.p === undefined ? undefined : file.fleet?.lines[version.p];
    const fleet: CatalogFleetInfo | null =
      fleetLine && file.fleet
        ? {
            reference: file.fleet.reference,
            lineCount: file.fleet.lineCount ?? file.fleet.lines.length,
            line: fleetLine,
          }
        : null;
    // PBEV is more precise on transmission (CVT vs automatic) when it
    // matched the exact version; otherwise the FIPE name wins.
    const transmission =
      inmetro?.confidence === "exact"
        ? (inmetro.transmission ?? attributes.transmission)
        : (attributes.transmission ?? inmetro?.transmission ?? undefined);

    const depreciation = versionDepreciation(
      version.y.map(([yearCode, price]) => {
        const year = Number(yearCode.split("-")[0]);
        return { modelYear: year === 32000 ? null : year, price };
      }),
    );
    const origin = fleetLine ? fleetOrigin(fleetLine) : null;

    for (const [yearCode, priceValue] of version.y) {
      const [year, fuelCode] = yearCode.split("-");
      const zeroKm = year === "32000";
      const fuel = file.fuels[fuelCode] ?? "";
      entries.push({
        id: `${brand.code}-${version.m}:${yearCode}`,
        category: snapshot.category,
        brand: brand.name,
        brandCode: brand.code,
        family,
        model: version.n,
        modelCode: version.m,
        codeFipe: version.f ?? null,
        yearCode,
        modelYear: zeroKm ? null : Number(year),
        zeroKm,
        fuel,
        propulsion: inmetro?.propulsion ?? derivePropulsion(fuel, attributes),
        transmission: transmission ?? null,
        gears: inmetro?.gears ?? null,
        bodyType: attributes.bodyHint ?? inmetro?.body ?? null,
        size: inmetro?.size ?? null,
        steering: inmetro?.steering ?? null,
        airConditioning: inmetro?.airConditioning ?? null,
        cityKmL: inmetro
          ? (inmetro.consumption.fuelCity ?? inmetro.consumption.electricCity)
          : null,
        highwayKmL: inmetro
          ? (inmetro.consumption.fuelHighway ?? inmetro.consumption.electricHighway)
          : null,
        inmetro,
        wikidata: version.w === undefined ? null : (file.models?.[version.w] ?? null),
        fleet,
        origin,
        depreciation,
        price: priceValue === null ? null : formatFipePrice(priceValue),
        priceValue,
        referenceCode: snapshot.reference,
        referenceMonth: snapshot.referenceMonth,
        attributes,
      });
    }
  }

  return { generatedAt: file.generatedAt, snapshots: file.snapshots, entries };
}
