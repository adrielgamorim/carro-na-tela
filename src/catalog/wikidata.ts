/**
 * Wikidata / Wikimedia Commons data of a model line ("Chevrolet Onix"),
 * matched to FIPE versions by name. It describes the whole line, so it is
 * always a "fuzzy" match for a given version.
 */
export interface CatalogModelInfo {
  /** Wikidata id, e.g. "Q18683502". */
  id: string;
  label: string;
  /** Opening of the Portuguese Wikipedia article, else the Wikidata description. */
  description?: string;
  wikipedia?: string;
  image?: {
    /** About 480 px wide. */
    thumb: string;
    /** Commons file page (author and license). */
    page: string;
    artist?: string;
    license?: string;
  };
}

export const wikidataUrl = (id: string) => `https://www.wikidata.org/wiki/${id}`;
