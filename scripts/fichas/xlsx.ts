// Reads the cells of a spreadsheet (.xlsx): a zip of XML files. Enough for
// the spec sheets of a press room: text and numbers of the first sheet, and
// the date the file was last saved. No formulas, styles or merged cells.

import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { readXls } from "./xls.ts";

/** The files in a zip, by name (only the stored and deflated ones). */
export function unzip(data: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // End of central directory: the last "PK\5\6".
  let end = data.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error("não é um arquivo zip");
  const count = view.getUint16(end + 10, true);
  let entry = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    const method = view.getUint16(entry + 10, true);
    const size = view.getUint32(entry + 20, true);
    const nameLength = view.getUint16(entry + 28, true);
    const extraLength = view.getUint16(entry + 30, true);
    const commentLength = view.getUint16(entry + 32, true);
    const local = view.getUint32(entry + 42, true);
    const name = new TextDecoder().decode(data.subarray(entry + 46, entry + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = data.subarray(start, start + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, new Uint8Array(inflateRawSync(raw)));
    entry += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export const decodeXml = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) =>
    code.startsWith("#x")
      ? String.fromCodePoint(parseInt(code.slice(2), 16))
      : code.startsWith("#")
        ? String.fromCodePoint(Number(code.slice(1)))
        : (entities[code] ?? whole),
  );
/** The text of the <t> elements in a piece of XML, joined. */
const textOf = (xml: string) =>
  decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((match) => match[1]).join(""));

/** "C12" → column 2 (0-based). */
const columnOf = (ref: string) =>
  [...(ref.match(/^[A-Z]+/)?.[0] ?? "A")].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;

export interface Spreadsheet {
  /** The first sheet's rows, each a list of cell texts by column ("" for empty). */
  rows: string[][];
  /** When it was last saved (docProps/core.xml), if it says. */
  modified?: Date;
}

export function readXlsx(data: Uint8Array): Spreadsheet {
  const files = unzip(data);
  const text = (name: string) => {
    const file = files.get(name);
    return file ? new TextDecoder().decode(file) : "";
  };
  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1]!));
  const sheetName = [...files.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort()[0] ?? "";
  const rows: string[][] = [];
  for (const row of text(sheetName).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of row[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1]!;
      const body = cell[2] ?? "";
      const ref = attributes.match(/\br="([A-Z]+)\d+"/)?.[1] ?? "";
      const type = attributes.match(/\bt="(\w+)"/)?.[1];
      const value = body.match(/<v>([^<]*)<\/v>/)?.[1];
      const content =
        type === "s" ? (shared[Number(value)] ?? "") : type === "inlineStr" ? textOf(body) : decodeXml(value ?? "");
      cells[ref ? columnOf(ref) : cells.length] = content.replace(/\s+/g, " ").trim();
    }
    if (cells.some(Boolean)) rows.push(Array.from(cells, (cell) => cell ?? ""));
  }
  const modified = text("docProps/core.xml").match(/<dcterms:modified[^>]*>([^<]+)</)?.[1];
  return { rows, ...(modified && { modified: new Date(modified) }) };
}

/** A spreadsheet file, .xlsx or old .xls whatever its name says. */
export async function readXlsxFile(path: string): Promise<Spreadsheet> {
  const data = new Uint8Array(await readFile(path));
  // "\xD0\xCF\x11\xE0": an OLE compound file, the old Excel format.
  if (data[0] === 0xd0 && data[1] === 0xcf) return { rows: readXls(data) };
  return readXlsx(data);
}
