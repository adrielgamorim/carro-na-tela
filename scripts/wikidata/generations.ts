// One picture per generation of a model line, from the infoboxes of its
// Wikipedia article. Articles like pt:Volkswagen Gol have one infobox per
// generation, each with a photo and the production years:
//
//   {{Info/Automóvel | nome = Gol G5 | imagem = [[Imagem:Volkswagen Gol 1.6 Trend 2011.jpg|250px]]
//   | produção = 2008–2012 }}
//
// so a 2010 Gol gets a G5 photo and a 2016 one a G6 photo, instead of the same
// picture of the line for every version. Where generations overlap, the
// version's name decides when it can: "Uno Mille" is the generation also
// called "Fiat Mille", "Gol (novo)" the newest one.

/** A generation's photo (Commons file name) and production years; `to` is null while still made. */
export interface Generation {
  file: string;
  from: number;
  to: number | null;
  /** Its name and other names, plain lowercase words ("first generation type 146 fiat mille brazil"). */
  names?: string;
}

const infoboxStart = /\{\{\s*(?:info\/autom[oó]vel|infobox automobile)/gi;
const imageField = /^\s*(?:image|imagem|foto)\s*=/i;
const productionField = /^\s*(?:production|produção|producao|model[ _]years|anos)\s*=/i;
const nameField = /^\s*(?:name|nome|aka|also[ _]called|outros[ _]nomes)\s*=/i;
// Pictures that do not show the car.
const notTheCar = /timeline|logo|emblem|badge|interior|engine|motor|dashboard|cockpit|\.svg$/i;
const present = /present|presente|atual|actual|current|hoje/i;

/** The top-level fields of the infobox starting at `start`. */
function fieldsAt(wikitext: string, start: number): string[] {
  let depth = 0;
  let part = "";
  const parts: string[] = [];
  for (let index = start; index < wikitext.length; index++) {
    const pair = wikitext.slice(index, index + 2);
    if (pair === "{{" || pair === "[[") {
      depth++;
      part += pair;
      index++;
      continue;
    }
    if (pair === "}}" || pair === "]]") {
      depth--;
      if (depth === 0) break;
      part += pair;
      index++;
      continue;
    }
    if (wikitext[index] === "|" && depth === 1) {
      parts.push(part);
      part = "";
      continue;
    }
    part += wikitext[index];
  }
  parts.push(part);
  return parts.slice(1);
}

/** "[[Imagem:Gol G5.jpg|250px]]", "Gol G5.jpg", "{{Imagem múltipla|…|image1=Gol.jpg…}}" → "Gol G5.jpg". */
export function imageFile(value: string): string | null {
  const text = value.replace(/<!--[\s\S]*?-->/g, "");
  const file = text.match(/(?:^|[:=|[\s])([^:=|[\]{}\n]+?\.(?:jpe?g|png|webp|tiff?|gif))\b/i)?.[1]?.trim();
  if (!file || notTheCar.test(file)) return null;
  return file.replace(/_/g, " ");
}

/**
 * Production years: "2008–2012", "[[2012]]-presente", or per country
 * ("{{ROMb}} 2007 — 2012 <br/> {{BRAb}} 2007 — 2014"), where Brazil wins.
 */
export function productionYears(value: string): [number, number | null] | null {
  const text = value
    .replace(/<ref[^>]*\/>/g, " ")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const segments = text.split(/<br\s*\/?>|\n\*/i);
  const brazil = segments.filter((segment) => /\bBRA\b|BRAb|Brasil|Brazil/i.test(segment));
  const chosen = (brazil.length ? brazil : segments).join(" ");
  const years = [...chosen.matchAll(/(?<!\d)(19[5-9]\d|20[0-4]\d)(?!\d)/g)].map((match) => Number(match[1]));
  if (years.length === 0) return null;
  const from = Math.min(...years);
  if (present.test(chosen)) return [from, null];
  return [from, Math.max(...years)];
}

/** "Novo Gol", "Citroën" → "novo gol", "citroen": lowercase letters and digits, no accents. */
export function plainWords(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Text of the name fields, without references, comments and markup. */
function namesOf(values: string[]): string {
  const text = values
    .join(" ")
    .replace(/<ref[^>]*\/>/g, " ")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return plainWords(text);
}

/**
 * Every infobox of the article with a photo and production years, in page
 * order; none when there is only one, which says nothing about generations.
 */
export function parseGenerations(wikitext: string): Generation[] {
  const generations: Generation[] = [];
  for (const match of wikitext.matchAll(infoboxStart)) {
    const fields = fieldsAt(wikitext, match.index);
    const value = (pattern: RegExp) => {
      const field = fields.find((item) => pattern.test(item));
      return field?.slice(field.indexOf("=") + 1) ?? "";
    };
    const file = imageFile(value(imageField));
    const years = productionYears(value(productionField));
    const names = namesOf(
      fields.filter((item) => nameField.test(item)).map((item) => item.slice(item.indexOf("=") + 1)),
    );
    if (file && years) generations.push({ file, from: years[0], to: years[1], names });
  }
  return generations.length > 1 ? generations : [];
}

const newest = new Set(["novo", "nova", "new"]);
// Body styles and trims every generation had, even when only one infobox says so.
const notAHint = new Set(["sedan", "hatch", "plus", "sport", "cabrio", "coupe", "wagon", "van", "pick"]);

/** "fifth generation" spans one generation; the article's own infobox ("1980–2023") spans several. */
function spansSeveral(generation: Generation, all: Generation[]): boolean {
  const end = (item: Generation) => item.to ?? Number.POSITIVE_INFINITY;
  const inside = all.filter(
    (other) => other !== generation && other.from >= generation.from - 1 && end(other) <= end(generation) + 1,
  );
  return inside.length >= 2;
}

/**
 * The generation of a model year: the narrowest production period that
 * covers it. A model year is often the year after production, so one year
 * past the end counts when no period covers the year itself. Earlier ones win
 * ties: the caller lists the Portuguese article first.
 *
 * With the version's name minus its line ("Mille Celeb. WAY ECON. 1.0"),
 * overlapping generations are told apart first: by its first word when only
 * some generations are also called that ("Fiat Mille"; the article's own
 * infobox, which lists every name, does not count), and for "novo" the one
 * that started last.
 */
export function generationOf<T extends Generation>(
  generations: T[],
  year: number,
  currentYear = new Date().getFullYear(),
  versionWords = "",
): T | undefined {
  // Still made: up to this year, so "2008–present" is not narrower than "2008–2012".
  const span = (generation: T) => (generation.to ?? Math.max(year, currentYear)) - generation.from;
  const covering = (slack: number) =>
    generations.filter(
      (generation) => year >= generation.from && (generation.to === null || year <= generation.to + slack),
    );
  let candidates = covering(0);
  if (candidates.length === 0) candidates = covering(1);
  if (candidates.length === 0) return undefined;
  const narrowest = (list: T[]) => {
    let best: T | undefined;
    for (const generation of list) if (!best || span(generation) < span(best)) best = generation;
    return best;
  };
  const best = narrowest(candidates);

  const words = plainWords(versionWords).split(" ");
  if (words.some((word) => newest.has(word))) {
    // One starting that very year is usually next year's model: a 2012 "Gol (novo)" is the G5.
    const started = candidates.filter((generation) => generation.from < year);
    if (started.length > 0) candidates = started;
    const latest = Math.max(...candidates.map((generation) => generation.from));
    return narrowest(candidates.filter((generation) => generation.from === latest));
  }

  const first = words[0] ?? "";
  if (first.length < 3 || /\d/.test(first) || notAHint.has(first)) return best;
  const single = candidates.filter((generation) => !spansSeveral(generation, generations));
  const named = single.filter((generation) => ` ${generation.names ?? ""} `.includes(` ${first} `));
  // Only a word some generations have and others not tells them apart, and
  // only a generation of another period changes the photo (pt stays before en).
  if (named.length === 0 || named.length === single.length) return best;
  const chosen = narrowest(named);
  if (!chosen || !best || Math.abs(chosen.from - best.from) <= 1) return best;
  return chosen;
}

/** A generation as shipped to build:catalog: its photo with thumbnail and credits. */
export interface ModelGeneration extends Generation {
  /** 480 px thumbnail on upload.wikimedia.org. */
  thumb?: string;
  artist?: string;
  license?: string;
}
