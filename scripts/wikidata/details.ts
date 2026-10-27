import { zeroKmYear } from "../catalog/crawl.ts";
import type { CatalogModelInfo, ModelSpecs } from "../../src/catalog/wikidata.ts";
import type { WikidataModel } from "./match.ts";

/** What fetch-wikidata downloads per model, besides the Wikidata item. */
export interface WikidataDetails {
  /** First sentences of the Portuguese Wikipedia article. */
  extract?: string;
  /** 480 px thumbnail on upload.wikimedia.org. */
  thumb?: string;
  artist?: string;
  license?: string;
}

/** Model years of FIPE year codes; 0 km counts as the current year. */
export function versionYears(yearCodes: string[], now = new Date()): number[] {
  return yearCodes.map((yearCode) => {
    const year = Number(yearCode.split("-")[0]);
    return year === zeroKmYear ? now.getFullYear() : year;
  });
}

const commonsFile = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

/** The model as shipped in the catalog index. */
export function toCatalogModel(
  model: WikidataModel,
  details: WikidataDetails = {},
  specs?: ModelSpecs,
): CatalogModelInfo {
  return {
    id: model.id,
    label: model.label,
    ...(specs && Object.keys(specs).length > 0 && { specs }),
    ...((details.extract ?? model.description) && {
      description: details.extract ?? model.description,
    }),
    ...(model.ptwiki && {
      wikipedia: `https://pt.wikipedia.org/wiki/${encodeURIComponent(model.ptwiki.replace(/ /g, "_"))}`,
    }),
    ...(model.image && {
      image: {
        thumb:
          details.thumb ??
          `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(model.image)}?width=480`,
        page: commonsFile(model.image),
        ...(details.artist && { artist: details.artist }),
        ...(details.license && { license: details.license }),
      },
    }),
  };
}
