import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfTextLine } from "./pbev.ts";

/**
 * Text lines of a PDF. Rotated tables (text at 90°) are read with the axes
 * swapped, so rows and columns come out the same way as in upright tables.
 */
export async function readPdfLines(file: string): Promise<PdfTextLine[]> {
  const document = await getDocument({
    data: new Uint8Array(await readFile(file)),
    verbosity: 0,
  }).promise;
  const lines: PdfTextLine[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const { items } = await page.getTextContent();
    const byRow = new Map<number, PdfTextLine>();
    for (const item of items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [a, b, , , x, y] = item.transform;
      const rotated = Math.abs(a) < 0.01 && Math.abs(b) > 0.01;
      // Rotated: rows run left to right (x), columns bottom to top (y).
      const rowPosition = Math.round(rotated ? -x : y);
      const center = rotated ? y + item.width / 2 : x + item.width / 2;
      const line = byRow.get(rowPosition) ?? { page: pageNumber, y: rowPosition, cells: [] };
      line.cells.push({ center, width: item.width, text: item.str });
      byRow.set(rowPosition, line);
    }
    lines.push(...byRow.values());
  }
  return lines;
}
