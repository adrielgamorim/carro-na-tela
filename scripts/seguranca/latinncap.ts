// Latin NCAP's crash test results, from its results page (one HTML listing
// every test as a card): the title ("Volkswagen Virtus + 4 Airbags"), the
// test year, the stars and the protocol. Until 2019 a car got stars for adult
// and for child occupants; since 2020, one rating with four percentages.

export interface CrashTest {
  id: number;
  /** "Volkswagen Virtus + 4 Airbags" */
  title: string;
  /** The brand as Latin NCAP writes it ("Chery / Chirey"). */
  brand: string;
  year: number;
  /** "2010", "2016" (until 2019) or "2020", "2026": the protocol's first year. */
  protocol: number;
  /** Since 2020: the one rating. */
  stars?: number;
  /** Until 2019: the ratings for adult and child occupants. */
  adultStars?: number;
  childStars?: number;
  /** Since 2020, in percent: adult, child, vulnerable road users, safety assist. */
  scores?: [number, number, number, number];
  url: string;
}

const site = "https://www.latinncap.com/";
const decode = (text: string) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** The tests of the results page's HTML. */
export function crashTests(html: string): CrashTest[] {
  const tests: CrashTest[] = [];
  for (const card of html.split('<a class="resultado-card').slice(1)) {
    const body = card.slice(0, card.indexOf("</a>"));
    const href = body.match(/href="([^"]*result\/(\d+)\/[^"]*)"/);
    const title = body.match(/<h3 class="resultado-titulo[^"]*">([^<]+)</)?.[1];
    const year = body.match(/TEST\s*<strong>(\d{4})<\/strong>/)?.[1];
    const protocol = body.match(/test--(\d{4})/)?.[1];
    const brand = body.match(/class="resultado-marca-logo" alt="([^"]+)"/)?.[1];
    if (!href || !title || !year || !protocol || !brand) continue;
    const stars = (pattern: RegExp) => {
      const found = body.match(pattern)?.[1];
      return found === undefined ? undefined : Number(found);
    };
    const percent = (name: string) => Number(body.match(new RegExp(`valor-${name}">\\s*([\\d.,]+)\\s*%`))?.[1]?.replace(",", ".") ?? NaN);
    const test: CrashTest = {
      id: Number(href[2]),
      title: decode(title),
      brand: decode(brand),
      year: Number(year),
      protocol: Number(protocol),
      url: site + href[1]!.replace(/^\//, ""),
    };
    if (body.includes("resultado-card--historico")) {
      // The image differs by protocol ("ico-3-estrellas.svg", "3_estrellas_adulto.svg"); its text does not.
      const adult = stars(/calificacion-adulto">[\s\S]*?alt="(\d) stars?"/);
      const child = stars(/calificacion-nino">[\s\S]*?alt="(\d) stars?"/);
      if (adult !== undefined) test.adultStars = adult;
      if (child !== undefined) test.childStars = child;
    } else {
      const overall = stars(/resultado-estrellas">\s*<img src="[^"]*ico-(\d)-estrellas/);
      if (overall !== undefined) test.stars = overall;
      const scores = ["adulto", "nino", "vulnerables", "asistentes"].map(percent);
      if (scores.every((score) => Number.isFinite(score))) test.scores = scores as CrashTest["scores"];
    }
    tests.push(test);
  }
  return tests.sort((a, b) => a.id - b.id);
}

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const wordsOf = (text: string) => plain(text).split(/[^a-z0-9]+/).filter(Boolean);
// Words of a tested model that FIPE does not write: "New Corolla", "Focus III", "Onix Hatchback".
const notInFipe = /^(new|novo|nova|nuevo|nueva|ii|iii|iv|v|vi|hatchback|hatch)$/;
// Latin NCAP's brands by the catalog's (src/catalog/brands.ts), which keeps FIPE's "VW - VolksWagen".
const brandOf = (brand: string) => {
  const own = plain(brand.split(" - ").at(-1) ?? brand);
  if (own.startsWith("chery")) return "chery";
  if (own.startsWith("great wall")) return "gwm";
  return wordsOf(own)[0] ?? own;
};

const compareRanks = (a: number[], b: number[]) => {
  for (const [index, value] of a.entries()) if (value !== b[index]) return value - b[index]!;
  return 0;
};

export interface CrashTarget {
  /** The catalog's brand ("Volkswagen", "Chery", "GWM"). */
  brand: string;
  family: string;
  name: string;
  modelYear: number;
}

/**
 * The crash test of a version-year: of its brand, naming its line (the
 * first word the FIPE family's, the others in the version's name: "Onix
 * Plus" only for an Onix Plus), from the year before the test to five after.
 * The most specific name wins, then a test of that model year or before, then the latest; of tests that year
 * (with more or fewer airbags), the lowest rating.
 */
export function crashTestOfVersion<T extends CrashTest>(tests: T[], target: CrashTarget): T | undefined {
  const brand = brandOf(target.brand);
  const family = wordsOf(target.family)[0] ?? "";
  const name = wordsOf(target.name);
  // "3" in "3x" (Tiggo 3X); "sed" (FIPE's "Sed.") for "sedan".
  const names = (word: string) =>
    name.some((own) => own === word || (/^\d/.test(word) && own.startsWith(word)) || (own.length >= 3 && word.startsWith(own)));
  let best: { test: T; rank: number[] } | undefined;
  for (const test of tests) {
    if (brandOf(test.brand) !== brand) continue;
    if (target.modelYear < test.year - 1 || target.modelYear > test.year + 5) continue;
    for (const model of testedModels(test)) {
      const own = wordsOf(model).filter((word) => !notInFipe.test(word));
      if (own[0] !== family || !own.slice(1).every(names)) continue;
      const rating = test.stars ?? Math.min(test.adultStars ?? 0, test.childStars ?? 0);
      // Most words, then one from the model year or before (a test the year after may be of a facelift),
      // then newest, then lowest rating; compared in that order.
      const rank = [own.length, test.year <= target.modelYear ? 1 : 0, test.year, -rating];
      if (!best || compareRanks(rank, best.rank) > 0) best = { test, rank };
    }
  }
  return best?.test;
}

/**
 * The models a test's title names, without the airbags or the VIN of the car
 * tested: "Renault Sandero / Logan + 2 Airbags" is "Sandero" and "Logan";
 * "Chery - Chirey Tiggo 2 / Tiggo 2 Pro" is "Tiggo 2" and "Tiggo 2 Pro".
 */
export function testedModels(test: Pick<CrashTest, "title" | "brand">): string[] {
  const brandWords = test.brand.split(/\s*[/-]\s*/).map((word) => word.trim().toLowerCase());
  let name = test.title
    .replace(/\s*\+\s*\d+\s*airbags?.*$/i, "")
    .replace(/\s*-?\s*(no|sin|sem)\s+airbags?.*$/i, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .trim();
  // "Chery - Chirey Tiggo 2", "Volkswagen Virtus": the brand's words first.
  for (;;) {
    const first = name.split(/\s+|\s*-\s*/)[0]?.toLowerCase();
    if (!first || !brandWords.includes(first)) break;
    name = name.slice(name.toLowerCase().indexOf(first) + first.length).replace(/^\s*[-/]?\s*/, "");
  }
  return name
    .split(/\s*\/\s*/)
    .map((model) => model.trim())
    .filter(Boolean);
}
