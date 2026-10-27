// The catalog index split per category and brand (public/catalog/marcas/),
// in the same wire format. The Consulta FIPE only needs the version it shows,
// so it loads the slice of that brand (tens of KB) instead of the whole
// index (megabytes).

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
    const path = brandShardPath(file.snapshots[version.s].category, file.brands[version.b].name);
    const group = groups.get(path) ?? [];
    if (group.length && group[0].b !== version.b) {
      throw new Error(
        `Marcas "${file.brands[group[0].b].name}" e "${file.brands[version.b].name}" geram o mesmo arquivo ${path}`,
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
        copy.w = remap(modelIndex, version.w, () => models.push(file.models![version.w!]), () => models.length);
      }
      if (version.p !== undefined && file.fleet) {
        copy.p = remap(lineIndex, version.p, () => lines.push(file.fleet!.lines[version.p!]), () => lines.length);
      }
      return copy;
    });

    shards.set(path, {
      version: 2,
      generatedAt: file.generatedAt,
      snapshots: file.snapshots,
      brands: [file.brands[versions[0].b]],
      fuels: file.fuels,
      versions: shardVersions,
      ...(file.models && { models }),
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
