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
import { commonsFile, toCatalogModel, versionYears } from "../wikidata/details.ts";
import { generationOf } from "../wikidata/generations.ts";
import { pressSpecsOf } from "../imprensa/facts.ts";
import type { PressFact } from "../imprensa/facts.ts";
import { sheetOfVersion, trimsOf } from "../fichas/sheets.ts";
import type { ReadSheet } from "../fichas/sheets.ts";
import { openSheetOfVersion } from "../fichas/open-sheets.ts";
import type { OpenSheet } from "../fichas/open-sheets.ts";
import { stellantisAsOpen } from "../fichas/stellantis-open.ts";
import { equipmentOfVersion } from "../fichas/equipment.ts";
import type { EquipmentList } from "../fichas/equipment.ts";
import { crashTestOfVersion } from "../seguranca/latinncap.ts";
import type { CrashTest } from "../seguranca/latinncap.ts";
import type { AutosegFile } from "../seguro/autoseg.ts";
import { catalogBrand } from "../../src/catalog/brands.ts";
import type { ModelGeneration } from "../wikidata/generations.ts";
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
    /** Lines whose fallback was chosen by hand (fallback-titles.json): it fits whatever the model. */
    chosenFallbacks?: string[];
    /** Size and mass per model (data/wikidata/specs.json). */
    specs?: Record<string, ModelSpecs>;
    /** Photo per generation of a model (data/wikidata/generations.json). */
    generations?: Record<string, ModelGeneration[]>;
  };
  /** Reviewed press release figures (data/imprensa/stellantis.json). */
  press?: PressFact[];
  /** Spec sheets read from the carmaker's PDFs (data/fichas/fichas.json). */
  sheets?: ReadSheet[];
  /** Spec sheets of the open press rooms, VW and Renault (data/fichas/fichas-abertas.json). */
  openSheets?: OpenSheet[];
  /** Equipment by version, Renault (data/fichas/equipamentos.json). */
  equipment?: EquipmentList[];
  /** Latin NCAP's crash tests (data/seguranca/latinncap.json). */
  crashTests?: CrashTest[];
  /** SUSEP's AUTOSEG summed by FIPE code (data/seguro/autoseg.json). */
  insurance?: AutosegFile;
}

const sameText = (left: string, right: string) =>
  left.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR") ===
  right.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");

/** Engine size of a version: from its FIPE name, else from INMETRO ("PULSE AUDACE Turbo 200" → "1.0T-12V"). */
function engineLitersOf(version: WireVersion): number | undefined {
  const pbev = /(\d)[.,](\d)/.exec(version.i?.engine ?? "");
  return version.a?.engineLiters ?? (pbev ? Number(`${pbev[1]}.${pbev[2]}`) : undefined);
}

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
    press,
    sheets,
    openSheets,
    equipment,
    crashTests,
    insurance,
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
  const photos: NonNullable<CatalogIndexFile["photos"]> = [];
  if (wikidata) {
    const photoIndex = new Map<string, number>();
    const match = createWikidataMatcher(wikidata.models, wikidata.overrides);
    const modelIndex = new Map<string, number>();
    const chosenFallbacks = new Set(wikidata.chosenFallbacks);
    for (const version of sorted) {
      const model = match({
        brand: brandName(version),
        model: version.n,
        years: versionYears(version.y.map(([yearCode]) => yearCode), now),
      });
      const lineKey = fallbackKey(brandName(version), getModelFamily(version.n));
      const fallback = wikidata.fallback?.[lineKey] ?? undefined;
      const fromWikidata = model ? toCatalogModel(model, wikidata.details?.[model.id], wikidata.specs?.[model.id]) : undefined;
      // A Wikidata model without an image keeps its text and borrows the
      // line's fallback picture.
      const info = fromWikidata
        ? fromWikidata.image ||
          !fallback?.image ||
          (!chosenFallbacks.has(lineKey) && !fallbackFitsModel(fallback.label, fromWikidata.label, brandName(version)))
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

      // Each model year gets the photo of its generation, when the line's
      // articles have one per generation and it differs from the line's own.
      const generations = wikidata.generations?.[info.id];
      if (!generations) continue;
      const years = versionYears(version.y.map(([yearCode]) => yearCode), now);
      // The name after the line ("Mille Celeb. 1.0") can tell overlapping generations apart.
      const versionWords = version.n.trim().slice(getModelFamily(version.n).length);
      const perYear = years.map((year) => {
        const generation = generationOf(generations, year, now.getFullYear(), versionWords);
        if (!generation?.thumb) return -1;
        const page = commonsFile(generation.file);
        if (page === info.image?.page) return -1;
        if (!photoIndex.has(page)) {
          photoIndex.set(page, photos.length);
          photos.push({
            thumb: generation.thumb,
            page,
            ...(generation.artist && { artist: generation.artist }),
            ...(generation.license && { license: generation.license }),
          });
        }
        return photoIndex.get(page)!;
      });
      if (perYear.some((photo) => photo >= 0)) version.g = perYear;
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

  // Trunk and torque from press releases, per model year: the figure of the
  // year's generation, and torque only for the engine it was given for.
  const pressFigures: NonNullable<CatalogIndexFile["press"]> = [];
  if (press?.length) {
    const figureIndex = new Map<PressFact, number>();
    const indexOf = (fact: PressFact | undefined) => {
      if (!fact) return -1;
      if (!figureIndex.has(fact)) {
        figureIndex.set(fact, pressFigures.length);
        pressFigures.push({ kind: fact.kind, value: fact.value, source: fact.source });
      }
      return figureIndex.get(fact)!;
    };
    for (const version of sorted) {
      const fuel = versionFuel.get(version) ?? "";
      const target = {
        brand: brandName(version),
        family: getModelFamily(version.n),
        name: version.n,
        engineLiters: engineLitersOf(version),
        valves: version.a?.valves,
        turbo: version.a?.aspiration === "turbo",
        diesel: /diesel/i.test(fuel),
      };
      const perYear = versionYears(version.y.map(([yearCode]) => yearCode), now).map((modelYear) => {
        const { trunk, torque } = pressSpecsOf(press, { ...target, modelYear });
        return [indexOf(trunk), indexOf(torque)] as [number, number];
      });
      if (perYear.some(([trunk, torque]) => trunk >= 0 || torque >= 0)) version.r = perYear;
    }
  }

  // Spec sheets: the one of each version-year, by trim, engine, transmission and year.
  const sheetList: NonNullable<CatalogIndexFile["sheets"]> = [];
  if (sheets?.length || openSheets?.length) {
    // Stellantis' sheets the exact match leaves out are tried the open press rooms' way.
    const fallback = [...(openSheets ?? []), ...(sheets ?? []).flatMap((sheet) => stellantisAsOpen(sheet) ?? [])];
    const sheetIndex = new Map<ReadSheet | OpenSheet, number>();
    const sources = { vw: "Volkswagen", renault: "Renault", toyota: "Toyota", stellantis: "Stellantis" } as const;
    // Each line's trim words, to read them in the sheets' titles.
    const lineNames = new Map<string, string[]>();
    for (const version of sorted) {
      const line = `${brandName(version)}|${getModelFamily(version.n)}`;
      lineNames.set(line, [...(lineNames.get(line) ?? []), version.n]);
    }
    const lineTrims = new Map([...lineNames].map(([line, names]) => [line, trimsOf(names, line.split("|")[1] ?? "")]));
    for (const version of sorted) {
      const lineKey = `${brandName(version)}|${getModelFamily(version.n)}`;
      const target = {
        brand: brandName(version),
        family: getModelFamily(version.n),
        name: version.n,
        engineLiters: engineLitersOf(version),
        turbo: version.a?.aspiration === "turbo",
      };
      const electric = /el[eé]tric/i.test(versionFuel.get(version) ?? "");
      const hybrid = /h[ií]brid|hybrid/i.test(`${version.n} ${versionFuel.get(version) ?? ""}`);
      const perYear = versionYears(version.y.map(([yearCode]) => yearCode), now).map((modelYear) => {
        // Stellantis' sheets are of the exact version and year; the open ones of an engine and a few years.
        const sheet =
          (sheets && sheetOfVersion(sheets, { ...target, modelYear }, lineTrims.get(lineKey) ?? new Set())) ??
          openSheetOfVersion(fallback, {
            ...target,
            modelYear,
            electric,
            hybrid,
            diesel: /diesel/i.test(versionFuel.get(version) ?? ""),
            valves: version.a?.valves,
          });
        if (!sheet) return -1;
        if (!sheetIndex.has(sheet)) {
          sheetIndex.set(sheet, sheetList.length);
          sheetList.push({
            title: sheet.title,
            page: sheet.page,
            specs: sheet.specs,
            // A PDF opens in the browser; Renault's spreadsheet would download, so its page.
            ...("line" in sheet && { source: sources[sheet.brand], ...((sheet.brand === "vw" || sheet.brand === "toyota") && { url: sheet.url }) }),
          });
        }
        return sheetIndex.get(sheet)!;
      });
      if (perYear.some((sheet) => sheet >= 0)) version.t = perYear;
    }
  }

  // Crash tests: the line's Latin NCAP test of each version-year.
  const crashList: NonNullable<CatalogIndexFile["crashTests"]> = [];
  if (crashTests?.length) {
    const testIndex = new Map<CrashTest, number>();
    for (const version of sorted) {
      const target = { brand: catalogBrand(brandName(version)), family: getModelFamily(version.n), name: version.n };
      const perYear = versionYears(version.y.map(([yearCode]) => yearCode), now).map((modelYear) => {
        const test = crashTestOfVersion(crashTests, { ...target, modelYear });
        if (!test) return -1;
        if (!testIndex.has(test)) {
          testIndex.set(test, crashList.length);
          const { id: _id, brand: _brand, ...kept } = test;
          void _id;
          void _brand;
          crashList.push(kept);
        }
        return testIndex.get(test)!;
      });
      if (perYear.some((test) => test >= 0)) version.c = perYear;
    }
  }

  // Insurance: AUTOSEG's figures of the version's FIPE code; a code newer than
  // the data takes its line's (the brand's codes of that family, by exposure).
  if (insurance) {
    const lineSums = new Map<string, { exposure: number; rate: number; theft: number }>();
    const lineOf = (version: WireVersion) => `${brandName(version)}|${getModelFamily(version.n)}`;
    for (const version of sorted) {
      const own = version.f ? insurance.models[version.f] : undefined;
      if (!own) continue;
      const sum = lineSums.get(lineOf(version)) ?? { exposure: 0, rate: 0, theft: 0 };
      sum.exposure += own[0];
      sum.rate += own[1] * own[0];
      sum.theft += own[2] * own[0];
      lineSums.set(lineOf(version), sum);
    }
    for (const version of sorted) {
      const own = version.f ? insurance.models[version.f] : undefined;
      const line = lineSums.get(lineOf(version));
      if (own) version.u = [Math.round(own[1] * 10_000), Math.round(own[2] * 10), 0];
      else if (line && line.exposure > 0) {
        version.u = [Math.round((line.rate / line.exposure) * 10_000), Math.round((line.theft / line.exposure) * 10), 1];
      }
    }
  }

  // Equipment: the list of each version-year's trim.
  const equipmentLists: NonNullable<CatalogIndexFile["equipment"]> = [];
  if (equipment?.length) {
    const listIndex = new Map<EquipmentList, number>();
    for (const version of sorted) {
      const target = {
        brand: brandName(version),
        family: getModelFamily(version.n),
        name: version.n,
        engineLiters: engineLitersOf(version),
        valves: version.a?.valves,
        turbo: version.a?.aspiration === "turbo",
        electric: /el[eé]tric/i.test(versionFuel.get(version) ?? ""),
        hybrid: /h[ií]brid|hybrid/i.test(`${version.n} ${versionFuel.get(version) ?? ""}`),
      };
      const perYear = versionYears(version.y.map(([yearCode]) => yearCode), now).map((modelYear) => {
        const list = equipmentOfVersion(equipment, { ...target, modelYear });
        if (!list) return -1;
        if (!listIndex.has(list)) {
          listIndex.set(list, equipmentLists.length);
          const source = list.brand === "toyota" ? "Toyota" : list.brand === "vw" ? "Volkswagen" : "Renault";
          equipmentLists.push({ title: list.title, source, page: list.page, groups: list.groups });
        }
        return listIndex.get(list)!;
      });
      if (perYear.some((list) => list >= 0)) version.q = perYear;
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
    ...(photos.length > 0 && { photos }),
    ...(pressFigures.length > 0 && { press: pressFigures }),
    ...(sheetList.length > 0 && { sheets: sheetList }),
    ...(equipmentLists.length > 0 && { equipment: equipmentLists }),
    ...(crashList.length > 0 && { crashTests: crashList }),
    ...(insurance && {
      insurance: {
        period: insurance.period,
        source: insurance.source,
        nationalRate: insurance.nationalRate,
        nationalTheft: insurance.nationalTheft,
        states: insurance.states,
      },
    }),
    ...(fleet &&
      fleetLines && {
        fleet: { reference: fleet.reference, source: fleet.source, lines: fleetLines },
      }),
  };
}
