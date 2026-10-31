// The text of the brand sites' HTML (Kia, GWM): their pages are regular
// enough to read with patterns, without a DOM.

const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** "Conforto &amp; Convenien&#231;ia <b>x</b>" → "Conforto & Conveniencia x", one space between words. */
export function htmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name.toLowerCase()] ?? entity)
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface HtmlCell {
  /** Its attributes as written: ` class="x" data-versao="N.855"`. */
  attributes: string;
  text: string;
}

/** The rows of a piece of HTML, each a list of its cells. */
export function htmlRows(html: string): HtmlCell[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1]!.matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => ({ attributes: cell[1]!, text: htmlText(cell[2]!) })),
  );
}

/** An attribute of a cell: `attribute(cell, "data-versao")`. */
export const attribute = (cell: HtmlCell, name: string) => cell.attributes.match(new RegExp(`${name}="([^"]*)"`))?.[1];
