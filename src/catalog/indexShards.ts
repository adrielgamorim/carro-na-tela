// The catalog index split per category and brand (public/catalog/marcas/),
// in the same wire format. The Consulta FIPE only needs the version it shows,
// so it loads the slice of that brand (tens of KB) instead of the whole
// index (megabytes).

import { at } from "./indexFormat.ts";
import type { CatalogIndexFile, WireVersion } from "./indexFormat.ts";
import type { VehicleCategory } from "../types/vehicle.ts";

/** "VW - VolksWagen" → "vw-volkswagen" */
export function brandSlug(brand: string): string {
  return brand
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Path of a brand's slice, relative to the catalog folder. */
export function brandShardPath(category: VehicleCategory, brand: string): string {
  return `marcas/${category}-${brandSlug(brand)}.json`;
}

/**
 * One index per category and brand, keyed by `brandShardPath`. Wikidata
 * models and fleet lines are reduced to the ones the brand uses; the fleet
 * keeps the total line count, so ranks still read "12º de 677".
 */
export function splitCatalogIndex(file: CatalogIndexFile): Map<string, CatalogIndexFile> {
  const groups = new Map<string, WireVersion[]>();
  for (const version of file.versions) {
    const brand = at(file.brands, version.b, "marca");
    const path = brandShardPath(at(file.snapshots, version.s, "snapshot").category, brand.name);
    const group = groups.get(path) ?? [];
    const first = group[0];
    if (first && first.b !== version.b) {
      throw new Error(
        `Marcas "${at(file.brands, first.b, "marca").name}" e "${brand.name}" geram o mesmo arquivo ${path}`,
      );
    }
    group.push(version);
    groups.set(path, group);
  }

  const shards = new Map<string, CatalogIndexFile>();
  for (const [path, versions] of groups) {
    const models: NonNullable<CatalogIndexFile["models"]> = [];
    const modelIndex = new Map<number, number>();
    const lines: NonNullable<CatalogIndexFile["fleet"]>["lines"] = [];
    const lineIndex = new Map<number, number>();
    const photos: NonNullable<CatalogIndexFile["photos"]> = [];
    const photoIndex = new Map<number, number>();
    const press: NonNullable<CatalogIndexFile["press"]> = [];
    const pressIndex = new Map<number, number>();
    const sheets: NonNullable<CatalogIndexFile["sheets"]> = [];
    const sheetIndex = new Map<number, number>();
    const crashTests: NonNullable<CatalogIndexFile["crashTests"]> = [];
    const crashIndex = new Map<number, number>();
    const remap = (index: Map<number, number>, from: number, add: () => void, size: () => number) => {
      if (!index.has(from)) {
        index.set(from, size());
        add();
      }
      return index.get(from)!;
    };

    const shardVersions = versions.map((version) => {
      const copy: WireVersion = { ...version, b: 0 };
      if (version.w !== undefined && file.models) {
        copy.w = remap(modelIndex, version.w, () => models.push(at(file.models!, version.w!, "modelo")), () => models.length);
      }
      if (version.g && file.photos) {
        copy.g = version.g.map((photo) =>
          photo < 0
            ? photo
            : remap(photoIndex, photo, () => photos.push(at(file.photos!, photo, "foto")), () => photos.length),
        );
      }
      if (version.r && file.press) {
        copy.r = version.r.map(
          (figures) =>
            figures.map((figure) =>
              figure < 0
                ? figure
                : remap(pressIndex, figure, () => press.push(at(file.press!, figure, "dado de release")), () => press.length),
            ) as [number, number],
        );
      }
      if (version.t && file.sheets) {
        copy.t = version.t.map((sheet) =>
          sheet < 0
            ? sheet
            : remap(sheetIndex, sheet, () => sheets.push(at(file.sheets!, sheet, "ficha")), () => sheets.length),
        );
      }
      if (version.c && file.crashTests) {
        copy.c = version.c.map((test) =>
          test < 0
            ? test
            : remap(crashIndex, test, () => crashTests.push(at(file.crashTests!, test, "teste da Latin NCAP")), () => crashTests.length),
        );
      }
      if (version.p !== undefined && file.fleet) {
        copy.p = remap(lineIndex, version.p, () => lines.push(at(file.fleet!.lines, version.p!, "linha da frota")), () => lines.length);
      }
      return copy;
    });

    shards.set(path, {
      version: 2,
      generatedAt: file.generatedAt,
      snapshots: file.snapshots,
      brands: [at(file.brands, versions[0]!.b, "marca")],
      fuels: file.fuels,
      versions: shardVersions,
      ...(file.models && { models }),
      ...(file.photos && { photos }),
      ...(file.press && press.length > 0 && { press }),
      ...(file.sheets && sheets.length > 0 && { sheets }),
      ...(file.crashTests && crashTests.length > 0 && { crashTests }),
      ...(file.insurance && shardVersions.some((version) => version.u) && { insurance: file.insurance }),
      ...(file.fleet && {
        fleet: {
          reference: file.fleet.reference,
          source: file.fleet.source,
          lineCount: file.fleet.lineCount ?? file.fleet.lines.length,
          lines,
        },
      }),
    });
  }
  return shards;
}
