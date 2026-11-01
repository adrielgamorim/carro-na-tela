// The equipment by version some press releases list: a header per version
// with its price ("Fiat Argo Drive 1.0 – R$ 58.890", "Versão Techno –
// R$ 75.990") over its items, one per line (Renault's "Principais itens de
// série:", Stellantis's lists) or in prose ("A versão acrescenta ao que já
// consta no Argo 1.0 itens como banco do motorista com regulagem de altura,
// …"). A version often lists only what it adds to another ("Todos os itens
// da versão Live Go mais:"). Drafts for hand review (npm run
// extract:equipamentos): the prose ones above all.

import { decodeEntities, plainWords } from "./press.ts";

export interface VersionBlock {
  /** The header line, as written. */
  header: string;
  /** "Fiat Argo Drive 1.0", "Techno": the header without its price. */
  version: string;
  /** The block's lines, header left out. */
  lines: string[];
  /** The version it adds to, as the text names it ("Evolution", "Argo 1.0"). */
  base?: string;
  /** Drafted standard items. */
  items: string[];
  /** Drafted optional ones. */
  optional: string[];
  /** Whether the items came from prose (less to trust). */
  prose: boolean;
}

// "Fiat Argo Drive 1.0 – R$ 58.890,00", "Duster Zen Plus 1.6 MT (R$ 107.990)", "Kwid Zen 1.0: R$ 60.604".
const priced = /^(.{2,80}?)\s*(?:[–—-]|:|\(|\bpor\b)\s*(?:a partir de\s*)?R\$\s?\d{1,3}(?:\.\d{3})+(?:,\d{2})?\s*\)?\.?\s*$/i;
// Prices of the options, not versions: "Pack AFS – R$ 1.839", "Pintura metálica – R$ 1.990".
const notAVersion = /^(opcion|pack|pacote|kit|pintura|acess[óo]rio|cor\b|teto|rodas?\b|tapete|pre[çc]o|valor|garantia|seguro|frete|plano)/i;
// Where the versions end: the boilerplate after them.
const stop =
  /^(sobre a|sobre o|a marca \S+$|legenda:|pre[çc]os? (de|v[áa]lidos|sugeridos|p[úu]blicos)|ficha t[ée]cnica|fotos|b-roll|v[íi]deos?|assessoria|informa[çc][õo]es [àa] imprensa|contato|inscreva-se|(e )?para visualizar|pol[íi]tica de)/i;
// Lines that introduce the items or name the base; not items themselves.
const intro = /itens de s[ée]rie|equipamentos de s[ée]rie|principais itens|conte[úu]do de s[ée]rie|^de s[ée]rie|^s[ée]rie:|^itens:|^equipamentos:/i;
const optionalIntro = /^(opcionais|opcional|itens opcionais|pacotes? opcionais|pack)\b/i;
// Lines of a list that are not items: the colors, leftover markup, notes.
// …and what speaks to the reader: "Acesse a Ficha Técnica", "clicar no botão ITENS DE SÉRIE".
const notAnItem =
  /^(cores? dispon[íi]ve(l|is)|cores?:|<|\*|obs\b|observa[çc]|acesse|confira|diferenciais d|escolher|clicar|para mais informa|dispon[íi]vel para|100%)|https?:\/\/|clique aqui|\s[–-]$/i;
const price = /\s*[–—.:-]?\s*\(?R\$\s?[\d.,]+\)?/g;

/** "· Kwid Zen 1.0", "Versão Evolution" → "Kwid Zen 1.0", "Evolution". */
function versionName(text: string): string {
  return text
    .replace(/^[\s·•–—*-]+/, "")
    .replace(/^vers[ãa]o\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "NOVO - Central multimídia de 10,1”" → "Central multimídia de 10,1”"; "• Alarme;" → "Alarme". */
function cleanItem(text: string): string {
  return text
    .replace(/^[\s·•§–—*-]+/, "")
    .replace(/^nov[oa]s?\s*[–—:-]\s*/i, "")
    .replace(/[;,.:]$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Pack AFS: protetor de cárter + câmera de ré": the items, not split inside "10,1". */
const itemsOf = (text: string) =>
  text
    .split(/\s*\+\s*|,\s*(?!\d)/)
    .map(cleanItem)
    .filter(Boolean);

/** The version a block adds to: "todos da versão Techno mais", "Todos os itens do Longitude, mais:", "Além dos equipamentos da versão Drive 1.0". */
export function baseOf(text: string): string | undefined {
  const match = text.match(
    /(?:[Tt]odos(?: os)?(?: itens| equipamentos)?(?= acima)|[Tt]odos(?: os)?(?: itens| equipamentos)? d[ao]s?|[Tt]odo o conte[úu]do d[ao]s?|^[Ii]tens d[ao]s?|[Aa]l[ée]m d[ao]s? (?:itens|equipamentos|conte[úu]dos?)(?: de s[ée]rie)?(?: presentes| oferecidos| j[áa] dispon[íi]veis)?(?: n[ao]s?| d[ao]s?)?|ao que j[áa] consta n[ao]s?|ao que j[áa] (?:é oferecido|existe) n[ao]s?|[Mm]esmos itens d[ao]s?|[Aa]crescenta em rela[çc][ãa]o [àa]o?s?)\s+(?:vers[ãa]o\s+|configura[çc][ãa]o\s+)?([\p{Lu}\d][\p{L}\d.!]*(?:\s+(?:[\p{Lu}\d][\p{L}\d.!]*|\d[.,]\d))*|(?<=vers[ãa]o )\p{Ll}+|acima)/u,
  );
  return match?.[1]?.replace(/[.,;:]$/, "");
}

const cue =
  /\b(?:itens como|equipamentos como|conte[úu]dos? como|traz(?: de s[ée]rie)?|conta(?:m)? com|acrescenta(?:[^,.]*?\bitens como)?|oferece|inclui|incorpora|agrega|adiciona|recebe|ganha|equipad[oa] com)\s+/i;

/** Items of a prose sentence: what follows its cue, split at commas and its last "e". */
export function proseItems(sentence: string): string[] {
  const at = sentence.search(cue);
  if (at < 0) return [];
  const rest = sentence
    .slice(at)
    .replace(cue, "")
    // "traz itens como …"
    .replace(/^(?:itens|equipamentos|conte[úu]dos?)(?: de s[ée]rie)? como\s+/i, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\.$/, "");
  return rest
    .split(/,\s*(?!\d)|;\s*|\s+e\s+(?=[^,]*$)|\s+além de\s+/)
    .map((item) => cleanItem(item).replace(/^(?:o|a|os|as|um|uma|de|novos?|novas?)\s+/i, ""))
    .filter((item) => item.length >= 3 && item.length <= 90 && !/R\$|\bvers[ãa]o\b|^que\b|^como\b/i.test(item))
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1));
}

/** The version blocks of a release's text (one paragraph or list item per line). */
export function versionBlocks(text: string): VersionBlock[] {
  const lines = text
    .split("\n")
    // Some came through encoded twice ("&amp;middot;").
    .map((line) => decodeEntities(line).trim())
    .filter(Boolean);
  const blocks: VersionBlock[] = [];
  let current: { header: string; version: string; lines: string[] } | undefined;
  const close = () => {
    if (current) blocks.push(draft(current));
    current = undefined;
  };
  for (const line of lines) {
    const header = line.length <= 100 ? line.match(priced) : null;
    // "Intense, os equipamentos da Zen mais – R$ 125.990": the version, and the one it adds to.
    const [named = "", adds] = header ? header[1]!.split(/,\s*(?=(?:os|todos)\b)/) : [];
    const version = versionName(named);
    if (header && version && !notAVersion.test(version) && version.split(" ").length <= 10) {
      close();
      current = { header: line, version, lines: adds ? [adds.replace(/^os /, "todos os ")] : [] };
    } else if (current && (stop.test(line) || current.lines.length >= 80)) {
      close();
    } else if (current) {
      current.lines.push(line);
    }
  }
  close();
  return blocks;
}

function draft(block: { header: string; version: string; lines: string[] }): VersionBlock {
  const items: string[] = [];
  const optional: string[] = [];
  let base: string | undefined;
  let inOptional = false;
  // A list: most lines short and without a full stop.
  const listed = block.lines.filter((line) => line.length <= 120 && !/[.!?]$/.test(line)).length;
  const isList = block.lines.length > 0 && listed >= block.lines.length * 0.6;
  for (const line of block.lines) {
    base ??= baseOf(line);
    if (optionalIntro.test(line)) {
      inOptional = true;
      // "Opcionais: Pack AFS: protetor de cárter + câmera de ré – R$ 1.839"
      const after = line.split(":").slice(1).join(":").replace(price, "").trim();
      if (after) optional.push(...itemsOf(after));
      continue;
    }
    if (isList) {
      if (intro.test(line) || baseOf(line)) {
        // "Principais itens de série: todos da versão Techno mais"; "Itens de série: ar-condicionado, …"
        const after = line.split(":").slice(1).join(":").trim();
        if (after && !baseOf(after)) items.push(...itemsOf(after));
        continue;
      }
      if (line.length > 120 || notAnItem.test(line)) continue;
      // "iTPMS • Limpador, lavador e desembaçador traseiro": two.
      for (const piece of line.replace(price, "").split(/\s+[•·§]\s+/)) {
        const item = cleanItem(piece);
        if (item) (inOptional ? optional : items).push(item);
      }
    } else {
      for (const sentence of line.split(/(?<=[.;!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔ])/)) {
        (/opciona/i.test(sentence) ? optional : items).push(...proseItems(sentence));
      }
    }
  }
  const unique = (list: string[]) => [...new Map(list.map((item) => [plainWords(item).trim(), item])).values()];
  return { ...block, ...(base && { base }), items: unique(items), optional: unique(optional), prose: !isList };
}
