// Wire format of public/catalog/index.json and its expansion into entries.
// One row per FIPE version (brand + model code) with its years nested, and
// brand/fuel names in lookup tables, keeps the full catalog to a few MB.

import type { InmetroSpec } from "./inmetro.ts";
import { versionDepreciation } from "./depreciation.ts";
import type { CatalogFleetInfo, CatalogFleetLine } from "./fleet.ts";
import { fleetOrigin } from "./fleet.ts";
import { versionLines } from "./sublines.ts";
import type { CatalogModelInfo, CatalogPhoto } from "./wikidata.ts";
import type { ModelNameAttributes } from "./modelName.ts";
import type { PressSource, PressSpecs } from "./press.ts";
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
  /**
   * Per entry of `y`, an index into `photos` (the generation of that model
   * year) or -1 for the model line's own photo. Omitted when all are -1.
   */
  g?: number[];
  /** Index into `fleet.lines`: the model line's fleet (Senatran). */
  p?: number;
  /**
   * Per entry of `y`, indexes into `press` of its trunk and torque figures
   * (-1 for none). Omitted when no year has any.
   */
  r?: [number, number][];
}

/** A trunk or torque figure from a press release, referenced by `WireVersion.r`. */
export interface WirePressFigure {
  kind: "trunk" | "torque";
  /** Liters (trunk) or kgfm (torque). */
  value: number;
  source: PressSource;
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
  /** Generation photos referenced by `WireVersion.g`. */
  photos?: CatalogPhoto[];
  /** Press release figures referenced by `WireVersion.r` (data/imprensa). */
  press?: WirePressFigure[];
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

/**
 * An item of one of the index's lookup tables. The indexes come from the
 * build, so a missing one means a broken file: better an error than an
 * entry with no brand.
 */
export function at<T>(list: T[], index: number, what: string): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Índice do catálogo corrompido: ${what} ${index} não existe`);
  return item;
}

export function expandCatalogIndex(file: CatalogIndexFile): CatalogIndex {
  const entries: CatalogEntry[] = [];

  // Line spelled once per brand ("UNO" / "Uno") and sub-line ("Uno Way").
  const lines = versionLines(file.versions.map((version) => [at(file.brands, version.b, "marca").name, version.n]));
  for (const [versionIndex, version] of file.versions.entries()) {
    const snapshot = at(file.snapshots, version.s, "snapshot");
    const brand = at(file.brands, version.b, "marca");
    const inmetro = version.i ?? null;
    // Some FIPE names omit the engine size ("PULSE AUDACE Turbo 200");
    // INMETRO writes it as "1.0T-12V".
    const pbevLiters = /(\d)[.,](\d)/.exec(inmetro?.engine ?? "");
    const attributes =
      version.a?.engineLiters === undefined && pbevLiters
        ? { ...version.a, engineLiters: Number(`${pbevLiters[1]}.${pbevLiters[2]}`) }
        : (version.a ?? {});
    const { family, subline } = lines[versionIndex] ?? { family: version.n, subline: null };
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

    const model = version.w === undefined ? null : (file.models?.[version.w] ?? null);
    for (const [yearIndex, [yearCode, priceValue]] of version.y.entries()) {
      const photo = file.photos?.[version.g?.[yearIndex] ?? -1];
      const [trunk, torque] = (version.r?.[yearIndex] ?? [-1, -1]).map((figure) => file.press?.[figure]);
      const press: PressSpecs | null =
        trunk || torque
          ? {
              ...(trunk && { trunk: { value: trunk.value, source: trunk.source } }),
              ...(torque && { torque: { value: torque.value, source: torque.source } }),
            }
          : null;
      const [year, fuelCode] = yearCode.split("-");
      const zeroKm = year === "32000";
      const fuel = file.fuels[fuelCode ?? ""] ?? "";
      entries.push({
        id: `${brand.code}-${version.m}:${yearCode}`,
        category: snapshot.category,
        brand: brand.name,
        brandCode: brand.code,
        family,
        ...(subline && { subline }),
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
        wikidata: model && photo ? { ...model, image: photo } : model,
        fleet,
        press,
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
