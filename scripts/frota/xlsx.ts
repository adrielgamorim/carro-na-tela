// Minimal .xlsx reader for the Senatran spreadsheets: a zip with shared
// strings and one sheet of plain cells. Enough for tables of text and
// numbers; no styles, dates or formulas.

import { inflateRawSync } from "node:zlib";

/** Entries of a zip file by name (central directory, stored or deflated). */
export function readZip(zip: Buffer): Map<string, () => Buffer> {
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Não é um arquivo zip");
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const entries = new Map<string, () => Buffer>();
  for (let index = 0; index < count; index++) {
    const method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, () => {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return method === 0 ? Buffer.from(data) : inflateRawSync(data);
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
