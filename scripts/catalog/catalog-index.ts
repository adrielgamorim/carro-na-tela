import type {
  CatalogIndexFile,
  WireVersion,
} from "../../src/catalog/indexFormat.ts";
import { at, derivePropulsion } from "../../src/catalog/indexFormat.ts";
import type { PbevRow } from "../../src/catalog/inmetro.ts";
import type { CatalogSnapshotInfo } from "../../src/catalog/types.ts";
import type { CatalogFleetLine } from "../../src/catalog/fleet.ts";
import type { ModelSpecs } from "../../src/catalog/wikidata.ts";
import { getModelFamily } from "../../src/services/fipeParsing.ts";
import type { FleetFile } from "../frota/frota.ts";
import { matchFleet } from "../frota/match.ts";
import { createInmetroMatcher } from "../inmetro/match.ts";
import { toCatalogModel, versionYears } from "../wikidata/details.ts";
import type { WikidataDetails } from "../wikidata/details.ts";
import { fallbackFitsModel, fallbackKey } from "../wikidata/fallback.ts";
import type { FallbackFile } from "../wikidata/fallback.ts";
import { createWikidataMatcher, findWikidataOverride } from "../wikidata/match.ts";
import type { WikidataModel, WikidataOverride } from "../wikidata/match.ts";
import { zeroKmYear } from "./crawl.ts";
import type { CrawledVehicle, FipeCategory } from "./crawl.ts";

/** Shape of data/fipe/<category>-<reference>.json written by crawl-fipe. */
export interface CrawlSnapshot {
  reference: string;
  referenceMonth: string | null;
  category: FipeCategory;
  listingComplete: boolean;
  stats?: { availableBrands?: number };
  vehicles: CrawledVehicle[];
}

/** Keeps only the newest reference month crawled for each category. */
export function selectLatestSnapshots(
  snapshots: CrawlSnapshot[],
): CrawlSnapshot[] {
  const latest = new Map<FipeCategory, CrawlSnapshot>();

  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.category);
    if (!current || Number(snapshot.reference) > Number(current.reference)) {
      latest.set(snapshot.category, snapshot);
    }
  }
  return [...latest.values()];
}

function yearRank(yearCode: string): number {
  const year = Number(yearCode.split("-")[0]);
  return year === zeroKmYear ? Number.POSITIVE_INFINITY : year;
}

/**
 * Manual correction of the FIPE ↔ INMETRO match (data/inmetro/overrides.json).
 * Selects FIPE versions by brand and exact model name or name prefix, then
 * forces a PBEV row (`use`), skips tables so older ones are tried
 * (`skipTables`), or blocks the match (`none`).
 */
export interface InmetroOverride {
  brand: string;
  model?: string;
  modelPrefix?: string;
  use?: { table: number; model: string; version: string; engine?: string };
  skipTables?: number[];
  none?: boolean;
  reason?: string;
}

export interface BuildOptions {
  now?: Date;
  /** PBEV rows of one or more yearly tables. */
  pbev?: PbevRow[];
  overrides?: InmetroOverride[];
  /** Overrides that point at a PBEV row that does not exist. */
  onWarning?: (message: string) => void;
  /** From npm run fetch:frota. */
  fleet?: FleetFile;
  /** From npm run fetch:wikidata. */
  wikidata?: {
    models: WikidataModel[];
    details?: Record<string, WikidataDetails>;
    overrides?: WikidataOverride[];
    /** Wikipedia/Commons pictures of lines with no Wikidata model (data/wikidata/fallback.json). */
    fallback?: FallbackFile;
    /** Size and mass per model (data/wikidata/specs.json). */
    specs?: Record<string, ModelSpecs>;
  };
}

const sameText = (left: string, right: string) =>
  left.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR") ===
  right.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");

function findOverride(overrides: InmetroOverride[], brand: string, model: string) {
  return overrides.find(
    (item) =>
      sameText(item.brand, brand) &&
      (item.model
        ? sameText(item.model, model)
        : item.modelPrefix !== undefined &&
          model.toLocaleLowerCase("pt-BR").startsWith(item.modelPrefix.toLocaleLowerCase("pt-BR"))),
  );
}

export function buildCatalogIndex(
  snapshots: CrawlSnapshot[],
  {
    now = new Date(),
    pbev = [],
    overrides = [],
    onWarning = () => {},
    wikidata,
    fleet,
  }: BuildOptions = {},
): CatalogIndexFile {
  const brands: CatalogIndexFile["brands"] = [];
  const brandIndex = new Map<string, number>();
  const brandName = (version: WireVersion) => at(brands, version.b, "marca").name;
  const fuels: CatalogIndexFile["fuels"] = {};
  const versions = new Map<string, WireVersion>();
  const infos: CatalogSnapshotInfo[] = [];
  // One matcher per yearly table, newest first.
  const tables = [...new Set(pbev.map((row) => row.table))].sort((a, b) => b - a);
  const matchers = tables.map((table) => ({
    table,
    match: createInmetroMatcher(pbev.filter((row) => row.table === table)),
  }));
  const newestTable = tables[0];
  const versionFuel = new Map<WireVersion, string>();

  selectLatestSnapshots(snapshots).forEach((snapshot, snapshotIndex) => {
    for (const vehicle of snapshot.vehicles) {
      if (!brandIndex.has(vehicle.brandCode)) {
        brandIndex.set(vehicle.brandCode, brands.length);
        brands.push({ code: vehicle.brandCode, name: vehicle.brand });
      }
      fuels[vehicle.yearCode.split("-")[1] ?? ""] ??= vehicle.fuel;

      const key = `${snapshotIndex}:${vehicle.brandCode}:${vehicle.modelCode}`;
      let version = versions.get(key);
      if (!version) {
        version = {
          s: snapshotIndex,
          b: brandIndex.get(vehicle.brandCode)!,
          m: vehicle.modelCode,
          n: vehicle.model,
          y: [],
        };
        if (Object.keys(vehicle.attributes).length > 0) {
          version.a = vehicle.attributes;
        }
        versions.set(key, version);
        versionFuel.set(version, vehicle.fuel);
      }
      if (vehicle.detail) version.f ??= vehicle.detail.codeFipe;
      if (!version.y.some(([yearCode]) => yearCode === vehicle.yearCode)) {
        version.y.push([vehicle.yearCode, vehicle.detail?.priceValue ?? null]);
      }
    }

    // The PBEV table of year T lists cars sold that year: model years T - 1
    // to T + 1, and 0 km for the newest table. Each version tries its tables
    // newest first and keeps the first match.
    let inmetroMatched = 0;
    if (newestTable !== undefined) {
      for (const version of versions.values()) {
        if (version.s !== snapshotIndex) continue;
        const years = version.y.map(([yearCode]) => yearRank(yearCode));
        const fuel = versionFuel.get(version) ?? "";
        const attributes = version.a ?? {};
        const override = findOverride(overrides, brandName(version), version.n);
        if (override?.none) continue;
        if (override?.use) {
          const { use } = override;
          const row = pbev.find(
            (item) =>
              item.table === use.table &&
              sameText(item.model, use.model) &&
              sameText(item.version, use.version) &&
              (use.engine === undefined || sameText(item.engine, use.engine)),
          );
          if (row) {
            const { brand: _brand, ...spec } = row;
            void _brand;
            version.i = { ...spec, confidence: "exact" };
            inmetroMatched += 1;
          } else {
            onWarning(
              `Ajuste sem linha no INMETRO ${use.table}: ${use.model} ${use.version} (para ${version.n})`,
            );
          }
          continue;
        }
        for (const { table, match } of matchers) {
          if (override?.skipTables?.includes(table)) continue;
          const covered = years.some((year) =>
            year === Number.POSITIVE_INFINITY
              ? table === newestTable
              : year >= table - 1 && year <= table + 1,
          );
          if (!covered) continue;
          const spec = match({
            brand: brandName(version),
            model: version.n,
            fuel,
            attributes,
            propulsion: derivePropulsion(fuel, attributes),
          });
          if (spec) {
            version.i = spec;
            inmetroMatched += 1;
            break;
          }
        }
      }
    }

    infos.push({
      category: snapshot.category,
      reference: snapshot.reference,
      referenceMonth: snapshot.referenceMonth,
      listingComplete: snapshot.listingComplete,
      brands: [...new Set(snapshot.vehicles.map((vehicle) => vehicle.brand))].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
      availableBrands: snapshot.stats?.availableBrands ?? null,
      listed: snapshot.vehicles.length,
      priced: snapshot.vehicles.filter((vehicle) => vehicle.detail).length,
      ...(newestTable !== undefined && { inmetroMatched }),
    });
  });

  const sorted = [...versions.values()].sort(
    (left, right) =>
      brandName(left).localeCompare(brandName(right), "pt-BR") ||
      left.n.localeCompare(right.n, "pt-BR") ||
      left.m.localeCompare(right.m),
  );
  for (const version of sorted) {
    version.y.sort(([left], [right]) => yearRank(right) - yearRank(left));
  }

  // Wikidata model lines, stored once and referenced by index.
  const models: CatalogIndexFile["models"] = [];
  if (wikidata) {
    const match = createWikidataMatcher(wikidata.models, wikidata.overrides);
    const modelIndex = new Map<string, number>();
    for (const version of sorted) {
      const model = match({
        brand: brandName(version),
        model: version.n,
        years: versionYears(version.y.map(([yearCode]) => yearCode), now),
      });
      const fallback = wikidata.fallback?.[fallbackKey(brandName(version), getModelFamily(version.n))] ?? undefined;
      const fromWikidata = model ? toCatalogModel(model, wikidata.details?.[model.id], wikidata.specs?.[model.id]) : undefined;
      // A Wikidata model without an image keeps its text and borrows the
      // line's fallback picture.
      const info = fromWikidata
        ? fromWikidata.image || !fallback?.image || !fallbackFitsModel(fallback.label, fromWikidata.label, brandName(version))
          ? fromWikidata
          : { ...fromWikidata, image: fallback.image }
        : findWikidataOverride(wikidata.overrides ?? [], { brand: brandName(version), model: version.n })?.none
          ? undefined
          : fallback && wikidata.specs?.[fallback.id]
            ? { ...fallback, specs: wikidata.specs[fallback.id] }
            : fallback;
      if (!info) continue;
      const known = modelIndex.get(info.id);
      if (known === undefined) {
        modelIndex.set(info.id, models.length);
        models.push(info);
      } else if (!models[known]?.image && info.image) {
        // The model was stored by a version with no fitting picture; a later
        // one has it, so the order of the versions does not decide.
        models[known] = info;
      }
      version.w = modelIndex.get(info.id);
    }
  }

  // Fleet per model line (brand + family), shared by the line's versions.
  let fleetLines: CatalogFleetLine[] | undefined;
  if (fleet) {
    const lineOfVersion = (version: WireVersion) =>
      `${brandName(version)}\n${getModelFamily(version.n)}`;
    const catalogLines = new Map(
      sorted.map((version) => [
        lineOfVersion(version),
        { brand: brandName(version), family: getModelFamily(version.n) },
      ]),
    );
    const match = matchFleet(fleet.models, [...catalogLines.values()], fleet.states);
    fleetLines = match.lines;
    for (const version of sorted) {
      const line = match.lineOf.get(lineOfVersion(version));
      if (line !== undefined) version.p = line;
    }
  }

  return {
    version: 2,
    generatedAt: now.toISOString(),
    snapshots: infos,
    brands,
    fuels,
    versions: sorted,
    ...(wikidata && { models }),
    ...(fleet &&
      fleetLines && {
        fleet: { reference: fleet.reference, source: fleet.source, lines: fleetLines },
      }),
  };
}
