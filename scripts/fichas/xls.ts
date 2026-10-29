// Reads the cells of an old Excel file (.xls, BIFF8 in an OLE compound file),
// which Renault serves for some sheets under an .xlsx name. Enough for spec
// sheets: the text and numbers of the first worksheet.

const sectorFree = 0xfffffffe;

/** The streams of an OLE compound file, by name. */
export function compoundStreams(data: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 0xe011cfd0) throw new Error("não é um arquivo OLE");
  const sectorSize = 1 << view.getUint16(0x1e, true);
  const miniSectorSize = 1 << view.getUint16(0x20, true);
  const miniCutoff = view.getUint32(0x38, true);
  const sector = (index: number) => data.subarray(512 + index * sectorSize, 512 + (index + 1) * sectorSize);

  // The sectors of the allocation table: 109 in the header, the rest in a chain of their own.
  const tableSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const index = view.getUint32(0x4c + i * 4, true);
    if (index < sectorFree) tableSectors.push(index);
  }
  for (let next = view.getUint32(0x44, true), count = view.getUint32(0x48, true); count-- > 0 && next < sectorFree; ) {
    const block = new DataView(sector(next).buffer, sector(next).byteOffset, sectorSize);
    for (let i = 0; i < sectorSize / 4 - 1; i++) {
      const index = block.getUint32(i * 4, true);
      if (index < sectorFree) tableSectors.push(index);
    }
    next = block.getUint32(sectorSize - 4, true);
  }
  const table: number[] = [];
  for (const index of tableSectors) {
    const block = sector(index);
    const blockView = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let i = 0; i < sectorSize / 4; i++) table.push(blockView.getUint32(i * 4, true));
  }
  const chain = (start: number, next: number[], read: (index: number) => Uint8Array) => {
    const parts: Uint8Array[] = [];
    for (let index = start, guard = 0; index < sectorFree && guard < next.length + 1; index = next[index] ?? sectorFree, guard++) {
      parts.push(read(index));
    }
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  };

  const directory = chain(view.getUint32(0x30, true), table, sector);
  const dirView = new DataView(directory.buffer, directory.byteOffset, directory.byteLength);
  const entries: { name: string; type: number; start: number; size: number }[] = [];
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const nameLength = dirView.getUint16(offset + 0x40, true);
    const name = String.fromCharCode(
      ...Array.from({ length: Math.max(0, nameLength / 2 - 1) }, (_, i) => dirView.getUint16(offset + i * 2, true)),
    );
    entries.push({
      name,
      type: dirView.getUint8(offset + 0x42),
      start: dirView.getUint32(offset + 0x74, true),
      size: dirView.getUint32(offset + 0x78, true),
    });
  }
  // Small streams live in the root entry's "mini stream", with a table of their own.
  const root = entries.find((entry) => entry.type === 5);
  const miniStream = root ? chain(root.start, table, sector) : new Uint8Array();
  const miniTableBytes = chain(view.getUint32(0x3c, true), table, sector);
  const miniTableView = new DataView(miniTableBytes.buffer, miniTableBytes.byteOffset, miniTableBytes.byteLength);
  const miniTable = Array.from({ length: miniTableBytes.length / 4 }, (_, i) => miniTableView.getUint32(i * 4, true));
  const miniSector = (index: number) => miniStream.subarray(index * miniSectorSize, (index + 1) * miniSectorSize);

  const streams = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry.type !== 2) continue;
    const bytes = entry.size < miniCutoff ? chain(entry.start, miniTable, miniSector) : chain(entry.start, table, sector);
    streams.set(entry.name, bytes.subarray(0, entry.size));
  }
  return streams;
}

/** An RK number: a 30-bit integer or the top of a double, maybe divided by 100. */
function rkNumber(rk: number): number {
  let value: number;
  if (rk & 2) value = rk >> 2;
  else {
    const bytes = new DataView(new ArrayBuffer(8));
    bytes.setUint32(4, rk & 0xfffffffc, true);
    value = bytes.getFloat64(0, true);
  }
  return rk & 1 ? value / 100 : value;
}

/** The first worksheet's rows of an .xls file, each a list of cell texts by column. */
export function readXls(data: Uint8Array): string[][] {
  const streams = compoundStreams(data);
  const book = streams.get("Workbook") ?? streams.get("Book");
  if (!book) throw new Error("sem planilha no arquivo");
  const view = new DataView(book.buffer, book.byteOffset, book.byteLength);

  // The records, with each record's CONTINUE parts kept apart: a string split
  // across them restarts with a flags byte.
  const records: { type: number; parts: Uint8Array[] }[] = [];
  for (let offset = 0; offset + 4 <= book.length; ) {
    const type = view.getUint16(offset, true);
    const length = view.getUint16(offset + 2, true);
    const body = book.subarray(offset + 4, offset + 4 + length);
    if (type === 0x003c && records.length) records.at(-1)!.parts.push(body);
    else records.push({ type, parts: [body] });
    offset += 4 + length;
  }

  const strings: string[] = [];
  const sst = records.find((record) => record.type === 0x00fc);
  if (sst) {
    let part = 0;
    let position = 8;
    const current = () => sst.parts[part]!;
    const byte = () => {
      if (position >= current().length) {
        part++;
        position = 0;
      }
      return current()[position++]!;
    };
    const uint16 = () => byte() | (byte() << 8);
    const uint32 = () => (uint16() | (uint16() << 16)) >>> 0;
    const skip = (count: number) => {
      for (let i = 0; i < count; i++) byte();
    };
    const total = new DataView(current().buffer, current().byteOffset).getUint32(4, true);
    for (let i = 0; i < total && part < sst.parts.length; i++) {
      const length = uint16();
      let flags = byte();
      const runs = flags & 8 ? uint16() : 0;
      const extra = flags & 4 ? uint32() : 0;
      let text = "";
      for (let char = 0; char < length; char++) {
        // A string cut by a CONTINUE goes on with a new flags byte (its width may change).
        if (position >= current().length) {
          part++;
          position = 0;
          flags = (flags & ~1) | (byte() & 1);
        }
        text += String.fromCharCode(flags & 1 ? uint16() : byte());
      }
      skip(runs * 4 + extra);
      strings.push(text);
    }
  }

  const rows: string[][] = [];
  const set = (row: number, column: number, text: string) => {
    (rows[row] ??= [])[column] = text.replace(/\s+/g, " ").trim();
  };
  // The cells of the first worksheet: after the globals' BOF, its own until EOF.
  let sheet = 0;
  for (const { type, parts } of records) {
    const body = parts[0]!;
    const cell = new DataView(body.buffer, body.byteOffset, body.byteLength);
    if (type === 0x0809) sheet++;
    if (sheet !== 2) continue;
    if (type === 0x000a) break;
    if (type === 0x00fd) set(cell.getUint16(0, true), cell.getUint16(2, true), strings[cell.getUint32(6, true)] ?? "");
    else if (type === 0x0203) set(cell.getUint16(0, true), cell.getUint16(2, true), String(cell.getFloat64(6, true)));
    else if (type === 0x027e) set(cell.getUint16(0, true), cell.getUint16(2, true), String(rkNumber(cell.getUint32(6, true))));
    else if (type === 0x00bd) {
      const row = cell.getUint16(0, true);
      const first = cell.getUint16(2, true);
      const count = (body.length - 6) / 6;
      for (let i = 0; i < count; i++) set(row, first + i, String(rkNumber(cell.getUint32(4 + i * 6 + 2, true))));
    } else if (type === 0x0204) {
      const length = cell.getUint16(6, true);
      const wide = body[8]! & 1;
      let text = "";
      for (let i = 0; i < length; i++) text += String.fromCharCode(wide ? cell.getUint16(9 + i * 2, true) : body[9 + i]!);
      set(cell.getUint16(0, true), cell.getUint16(2, true), text);
    }
  }
  return rows.filter(Boolean).map((row) => Array.from(row, (text) => text ?? "")).filter((row) => row.some(Boolean));
}
