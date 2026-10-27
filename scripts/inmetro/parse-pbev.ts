// Converts INMETRO PBEV PDFs into data/inmetro/pbev-<year>.json.
//
//   npm run parse:pbev                 # every year with a PDF and a layout
//   npm run parse:pbev -- --year=2026  # one year
//
// PDFs are downloaded from gov.br into data/inmetro/pbev-<year>.pdf.

import { access, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import type { PbevRow } from "../../src/catalog/inmetro.ts";
import { parsePbevLines, pbevLayouts } from "./pbev.ts";
import { readPdfLines } from "./pdf-lines.ts";

const { values } = parseArgs({
  options: {
    year: { type: "string", default: "all" },
    dir: { type: "string", default: "data/inmetro" },
  },
});

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const years =
  values.year === "all"
    ? Object.keys(pbevLayouts).map(Number)
    : [Number(values.year)];

for (const table of years) {
  const pdf = `${values.dir}/pbev-${table}.pdf`;
  if (!(await exists(pdf))) {
    console.log(`${table}: sem PDF em ${pdf}`);
    continue;
  }
  const rows: PbevRow[] = parsePbevLines(await readPdfLines(pdf), table);
  await writeFile(`${values.dir}/pbev-${table}.json`, `${JSON.stringify(rows, null, 1)}\n`);

  const count = (key: (row: PbevRow) => unknown) =>
    rows.filter((row) => key(row) !== null && key(row) !== "").length;
  console.log(
    `${table}: ${rows.length} versões · categoria ${count((row) => row.size ?? row.body)} · ` +
      `câmbio ${count((row) => row.transmission)} · combustível ${count((row) => row.fuel)} · ` +
      `consumo ${count((row) => row.consumption.fuelCity ?? row.consumption.electricCity)}`,
  );
}
