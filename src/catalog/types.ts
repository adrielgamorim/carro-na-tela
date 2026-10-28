import type { VehicleCategory } from "../types/vehicle.ts";
import type { InmetroSpec, SizeClass, Steering } from "./inmetro.ts";
import type { BodyHint, ModelNameAttributes, Transmission } from "./modelName.ts";
import type { Depreciation } from "./depreciation.ts";
import type { CatalogFleetInfo, Origin } from "./fleet.ts";
import type { CatalogModelInfo } from "./wikidata.ts";
import type { PressSpecs } from "./press.ts";

export type Propulsion =
  | "combustao"
  | "hibrido"
  | "hibrido-plugin"
  | "eletrico";

/** One FIPE version in one model year, as used by the catalog page. */
export interface CatalogEntry {
  /** `${brandCode}-${modelCode}:${yearCode}` */
  id: string;
  category: VehicleCategory;
  /** The maker, one name per maker (catalog/brands.ts): "Chery". */
  brand: string;
  /** FIPE's name for the brand ("Caoa Chery/Chery"), for lookups against FIPE. */
  fipeBrand: string;
  brandCode: string;
  /** Model line, one spelling per brand ("Uno"). */
  family: string;
  /** Line and the word after it ("Uno Way"), when the name has one. */
  subline?: string;
  model: string;
  modelCode: string;
  /** Known once the price was crawled. */
  codeFipe: string | null;
  yearCode: string;
  /** null for 0 km entries (FIPE model year 32000). */
  modelYear: number | null;
  zeroKm: boolean;
  fuel: string;
  propulsion: Propulsion;
  /** null until the price phase reaches this version-year. */
  price: string | null;
  priceValue: number | null;
  referenceCode: string;
  referenceMonth: string | null;
  /** Extracted from the FIPE model name; every field is optional. */
  attributes: ModelNameAttributes;
  // Merged from the FIPE name and INMETRO PBEV (see expandCatalogIndex).
  transmission: Transmission | null;
  gears: number | null;
  bodyType: BodyHint | null;
  size: SizeClass | null;
  steering: Steering | null;
  airConditioning: boolean | null;
  /** City / highway km/l (gasoline or diesel; km/l equivalent for EVs). */
  cityKmL: number | null;
  highwayKmL: number | null;
  inmetro: InmetroSpec | null;
  /** Picture and description of the model line (Wikidata, fuzzy match). */
  wikidata: CatalogModelInfo | null;
  /** Vehicles of the model line in circulation (Senatran, fuzzy match). */
  fleet: CatalogFleetInfo | null;
  /** Trunk and torque from the carmaker's press releases (Stellantis brands only). */
  press: PressSpecs | null;
  /** National or imported, by the line's Renavam registrations (null without fleet data). */
  origin: Origin | null;
  /** Average yearly loss of the version, from its priced model years. */
  depreciation: Depreciation | null;
}

export interface CatalogSnapshotInfo {
  category: VehicleCategory;
  reference: string;
  referenceMonth: string | null;
  /** Every version and year is listed (prices may still be missing). */
  listingComplete: boolean;
  brands: string[];
  /** Brands FIPE lists for the category, when the crawl recorded it. */
  availableBrands: number | null;
  listed: number;
  priced: number;
  /** Versions matched to an INMETRO PBEV row, when the table was available. */
  inmetroMatched?: number;
}

export interface CatalogIndex {
  generatedAt: string;
  snapshots: CatalogSnapshotInfo[];
  entries: CatalogEntry[];
}
