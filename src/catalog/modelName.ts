// Extracts vehicle attributes from FIPE model names such as
// "Renegade Trailhawk 2.0 4x4 TB Diesel Aut" or "Strada Trekking 1.6 16V Flex CS".
// FIPE names are free text, so every attribute is optional and only set when a
// token is unambiguous. Kept dependency-free so Node scripts can import it.

export type Transmission =
  | "manual"
  | "automatico"
  | "cvt"
  | "dct"
  | "automatizado";

// suv and minivan come from INMETRO categories, not from FIPE names.
export type BodyHint =
  | "hatch"
  | "suv"
  | "minivan"
  | "sedan"
  | "perua"
  | "cupe"
  | "conversivel"
  | "picape"
  | "furgao"
  | "van"
  | "chassi-cabine";

export type CabType = "simples" | "dupla" | "estendida";

export interface ModelNameAttributes {
  engineLiters?: number;
  valves?: number;
  cylinders?: number;
  aspiration?: "turbo" | "compressor";
  powerCv?: number;
  transmission?: Transmission;
  doors?: number;
  fourWheelDrive?: boolean;
  fuel?: "flex" | "diesel";
  propulsion?: "eletrico" | "hibrido" | "hibrido-plugin";
  bodyHint?: BodyHint;
  cab?: CabType;
}

// Whole-token match. JavaScript's \b treats accented letters as non-word
// characters, which breaks names like "Coupé" or "Sedã".
function token(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\d])(?:${source})(?![\\p{L}\\d])`, "iu");
}

// Order matters: the first matching rule wins. Some FIPE names glue tokens
// together ("4x4TipTronic", "TiCVT"), so a few rules match substrings.
const transmissionRules: [RegExp, Transmission][] = [
  [/CVT/i, "cvt"],
  [token("DCT|DSG|S-?Tronic|Powershift|PDK"), "dct"],
  [token("Dualogic|GSR|I-Motion|Easytronic|ASG|Automatizad[oa]"), "automatizado"],
  [/Tiptronic|Steptronic/i, "automatico"],
  [token("Aut|Autom[aá]tic[oa]?"), "automatico"],
  [token("Mec|Manual"), "manual"],
];

const bodyRules: [RegExp, BodyHint][] = [
  [token("Chassi"), "chassi-cabine"],
  [token("Furg[aã]o|Furg"), "furgao"],
  [token("Van|Minibus|Micro-?[ôo]nibus"), "van"],
  [token("Pick-?Up|P-Up|Picape|Cab"), "picape"],
  [token("Cabriolet|Cabrio|Conv|Convers[ií]vel|Roadster|Spider|Spyder|Targa"), "conversivel"],
  [token("Coup[eé]|Cup[eê]"), "cupe"],
  [token("SW|Weekend|Variant|Perua|Wagon"), "perua"],
  [token("Sedan|Sed[aã]|Sed"), "sedan"],
  [token("Hatch|Hatchback"), "hatch"],
];

const cabRules: [RegExp, CabType][] = [
  [token("CD|Cab\\.? ?Dupla|Cabine Dupla"), "dupla"],
  [token("CS|Cab\\.? ?Simples|Cabine Simples"), "simples"],
  [token("CE|Cab\\.? ?Estendida|Cabine Estendida"), "estendida"],
];

// CD/CS/CE are pickup cab codes, but also trim names on older cars
// ("Uno CS ... 4p", "Astra 2.0/ CD ... 3p"), so they only count when nothing
// else describes the body.
const cabCodePattern = token("CD|CS|CE");
const cabCodeTrimFamilies = new Set([
  "astra",
  "elba",
  "ipanema",
  "kadett",
  "meriva",
  "monza",
  "omega",
  "premio",
  "suprema",
  "uno",
  "vectra",
]);

const fourWheelPattern = /4x4|(?<![\p{L}\d])(AWD|4WD|4MATIC|4Motion|quattro|xDrive|ALL4|4XE)(?![\p{L}\d])/iu;
const twoWheelPattern = token("4x2|2WD");
// Bare "TB" only: "T.B." in vans means "teto baixo" (low roof).
// "T." and "Turb." abbreviate turbo ("1.0 200 T. Flex"); "T.A."/"T.B." (van
// roof heights) and VW's "T.Flex" (Total Flex) do not match as whole tokens.
const turboPattern = token(
  "TB|Bi-TB|Turbo|Bi-?Turbo|TSI|TFSI|TDI|T-?GDI|THP|EcoBoost|T\\.|Turb\\.?",
);
const compressorPattern = token("Kompressor|Compressor");
const electricPattern = token("El[eé]tric[oa]");
const plugInPattern = token("PHEV|Plug-?in");
const hybridPattern = token("H[ií]brido|Hybrid|HEV");
const flexPattern = /Flex/i;
const dieselPattern = token("Diesel|Dies|Die");

function firstMatch<T>(name: string, rules: [RegExp, T][]): T | undefined {
  return rules.find(([pattern]) => pattern.test(name))?.[1];
}

function parseEngineLiters(name: string): number | undefined {
  // "1.0", "2.0i", "1.8/" — but not part of longer numbers like "1.0.1".
  // Not inside a longer number, but "Hghli.1.6" (abbreviation glued to the size) counts.
  const match = /(?<!\d\.?)(\d\.\d)(?!\d|\.\d)/.exec(name);
  if (!match) return undefined;
  const liters = Number(match[1]);
  return liters >= 0.6 && liters <= 8.5 ? liters : undefined;
}

function parseFourWheelDrive(name: string): boolean | undefined {
  const allWheel = fourWheelPattern.test(name);
  const twoWheel = twoWheelPattern.test(name);

  if (allWheel && twoWheel) return undefined;
  if (allWheel) return true;
  if (twoWheel) return false;
  return undefined;
}

function parseAspiration(name: string): ModelNameAttributes["aspiration"] {
  if (compressorPattern.test(name)) return "compressor";
  if (turboPattern.test(name)) return "turbo";
  return undefined;
}

function parsePropulsion(name: string): ModelNameAttributes["propulsion"] {
  if (electricPattern.test(name)) return "eletrico";
  if (plugInPattern.test(name)) return "hibrido-plugin";
  if (hybridPattern.test(name)) return "hibrido";
  return undefined;
}

function parseFuel(name: string): ModelNameAttributes["fuel"] {
  if (flexPattern.test(name)) return "flex";
  if (dieselPattern.test(name)) return "diesel";
  return undefined;
}

export function parseModelName(name: string): ModelNameAttributes {
  const attributes: ModelNameAttributes = {};
  const set = <K extends keyof ModelNameAttributes>(
    key: K,
    value: ModelNameAttributes[K] | undefined,
  ) => {
    if (value !== undefined) attributes[key] = value;
  };

  set("engineLiters", parseEngineLiters(name));

  const valves = token("(6|8|12|16|20|24|32|40|48)V").exec(name);
  set("valves", valves ? Number(valves[1]) : undefined);

  const cylinders = token("[VW](6|8|10|12|16)").exec(name);
  set("cylinders", cylinders ? Number(cylinders[1]) : undefined);

  set("aspiration", parseAspiration(name));

  const power = token("(\\d{2,4}) ?cv").exec(name);
  set("powerCv", power ? Number(power[1]) : undefined);

  set("transmission", firstMatch(name, transmissionRules));

  const doors = token("([2-5])p").exec(name);
  set("doors", doors ? Number(doors[1]) : undefined);

  set("fourWheelDrive", parseFourWheelDrive(name));
  set("fuel", parseFuel(name));
  set("propulsion", parsePropulsion(name));
  set("bodyHint", firstMatch(name, bodyRules));
  const family = name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (
    !attributes.bodyHint &&
    !attributes.doors &&
    !cabCodeTrimFamilies.has(family) &&
    cabCodePattern.test(name)
  ) {
    set("bodyHint", "picape");
  }
  if (attributes.bodyHint === "picape") set("cab", firstMatch(name, cabRules));

  return attributes;
}
