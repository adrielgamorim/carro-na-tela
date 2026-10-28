// Reads trunk volume and torque out of press release prose (Stellantis
// Brasil's press room). Each finding is a candidate for hand review in
// data/imprensa/stellantis.json: the prose varies too much to trust blindly.

/** Engine a torque figure belongs to, as FIPE names describe it. */
export interface PressEngine {
  liters: number;
  turbo: boolean;
  diesel: boolean;
  /** When the release says ("1.8 16V", "8 válvulas"): tells the E.torQ 1.8 16V from the 1.8 8V. */
  valves?: number;
}

const entities: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', lt: "<", gt: ">", ndash: "–", mdash: "—", bull: "•",
  ordm: "º", ordf: "ª", deg: "°", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  hellip: "…", sup2: "²", sup3: "³", times: "×",
};
const marks: Record<string, string> = {
  acute: "́", grave: "̀", circ: "̂", tilde: "̃", uml: "̈", cedil: "̧",
};

/** Decodes the HTML entities the press site writes ("&ccedil;", "&#8211;"). */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (whole, name: string) => {
      const known = entities[name];
      if (known) return known;
      const accented = name.match(/^([a-zA-Z])(acute|grave|circ|tilde|uml|cedil)$/);
      return accented ? (accented[1]! + marks[accented[2]!]).normalize("NFC") : whole;
    });
}

/** Content of a meta tag ("og:title", "article:published_time"). */
export function metaContent(html: string, property: string): string {
  const match = html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`));
  return decodeEntities(match?.[1] ?? "");
}

/** The release body as plain text, one paragraph or list item per line. */
export function releaseText(html: string): string {
  const start = html.indexOf("fca-Description_News");
  if (start < 0) return "";
  const end = html.indexOf('id="DamAssets-shortcut-container"', start);
  const body = html.slice(html.indexOf(">", start) + 1, end > 0 ? end : undefined);
  return decodeEntities(
    body
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "")
      .replace(/<br\s*\/?>|<\/?(p|div|li|ul|ol|tr|h[1-6])\b[^>]*>/g, "\n")
      .replace(/<[^>]*>?/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Sentences of a release, so a figure stays with the words around it. */
export function sentences(text: string): string[] {
  return text
    .split(/\n|(?<=[.;!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕ“"])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

const number = (text: string) => Number(text.replace(/\./g, "").replace(",", "."));

/**
 * Trunk volume (liters) a sentence gives, if it is about the trunk: the
 * volume with the seats up, not the one with them folded.
 */
export function trunkLiters(sentence: string): number | null {
  if (!/porta-malas|bagageiro/i.test(sentence)) return null;
  for (const match of sentence.matchAll(/(\d{1,3}(?:\.\d{3})?)\s*(?:litros|l)\b/gi)) {
    const value = number(match[1]!);
    const before = sentence.slice(Math.max(0, match.index - 25), match.index);
    const after = sentence.slice(match.index + match[0].length, match.index + match[0].length + 60);
    // "até 1.175 litros", "1.760 litros com todos os bancos rebaixados", "(435 l na versão…)".
    if (/rebat|rebaix|bancos|assentos|fileira|amplia/i.test(after.split(/[,;(]/)[0] ?? "")) continue;
    if (/\b(até|chega a)\s*$/i.test(before) && /rebat|rebaix|amplia/i.test(sentence)) continue;
    if (/\(\s*$/.test(before)) continue;
    if (value >= 100 && value <= 1300) return value;
  }
  return null;
}

/** Highest torque (kgfm) a sentence gives, Nm converted; null when it gives none. */
export function torqueKgfm(sentence: string): number | null {
  if (!/torque/i.test(sentence)) return null;
  // "1.458 Nm" (a thousands dot), "27,50 kgfm", "20.4 kgf.m" (a decimal dot).
  const values = [
    ...sentence.matchAll(/(?<![\d.,])(\d{1,2}\.\d{3}|\d{1,3}(?:[.,]\d{1,2})?)\s*(kgf\.?\s?m|kgfm|Nm)\b/gi),
  ].map((match) => {
    const figure = /^\d{1,2}\.\d{3}$/.test(match[1]!) ? number(match[1]!) : Number(match[1]!.replace(",", "."));
    return /nm/i.test(match[2]!) ? figure / 9.80665 : figure;
  });
  const highest = Math.max(...values.filter((value) => value >= 5 && value <= 160));
  return Number.isFinite(highest) ? Math.round(highest * 10) / 10 : null;
}

// Engines named by Stellantis without their displacement.
const namedEngines: [RegExp, number, boolean][] = [
  [/turbo 200|\bt200\b/, 1.0, true],
  [/turbo 270|\bt270\b/, 1.3, true],
  [/turbo 180|\bt180\b/, 1.3, true],
  [/t-?jet/, 1.4, true],
  [/\bthp\b/, 1.6, true],
];

/** The one engine a sentence is about, or undefined when it names none or several. */
export function engineIn(sentence: string): PressEngine | undefined {
  const text = sentence.toLowerCase();
  const diesel = /diesel|multijet|hdi\b/.test(text);
  const valveCounts = new Set(
    [...text.matchAll(/\b(8|12|16|24)\s*(?:v\b|válvulas)/g)].map((match) => Number(match[1])),
  );
  if (/e\.?torq/.test(text)) valveCounts.add(16);
  const valves = valveCounts.size === 1 ? { valves: [...valveCounts][0]! } : {};
  for (const [pattern, liters, turbo] of namedEngines) {
    if (pattern.test(text)) return { liters, turbo, diesel, ...valves };
  }
  if (!/motor|propulsor|motoriza/.test(text)) return undefined;
  const found = new Set<number>();
  // "1.3", "2,0" — not "5,3 segundos", "1,8 metro", "R$ 2,5 mil", "14,2 kgfm".
  for (const match of text.matchAll(/(?<![\d.,$])([1-6])[.,](\d)(?!\d|[.,]\d)(?!\s*(?:segundos?|s\b|metros?|m\b|mil|milh|kgf|nm|litros|l\b|%|vez|cv|km|bar|pol|"|”))/g)) {
    found.add(Number(`${match[1]}.${match[2]}`));
  }
  if (found.size !== 1) return undefined;
  const turbo = /turbo|\btb\b|hurricane|multijet|hdi\b|biturbo/.test(text);
  return { liters: [...found][0]!, turbo, diesel, ...valves };
}

/** Plain lowercase words, padded with spaces for whole-word lookups. */
export const plainWords = (text: string) =>
  ` ${text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
