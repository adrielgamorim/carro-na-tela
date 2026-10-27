// Downloads the ANP fuel price survey (open data, last four weeks) and writes
// the average price per state to public/catalog/fuel-prices.json.
//
//   npm run fetch:anp -- [--out=public/catalog]
//
// The survey is weekly; running it more often only repeats the same week.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { formatAnpWeek } from "../../src/catalog/fuelPrices.ts";
import { parseAnpCsv, summarizeFuelPrices } from "./anp.ts";

const { values } = parseArgs({
  options: { out: { type: "string", default: "public/catalog" } },
});

const baseUrl =
  "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/qus";
const files = ["ultimas-4-semanas-gasolina-etanol.csv", "ultimas-4-semanas-diesel-gnv.csv"];
// gov.br answers 403 to requests without browser-like headers.
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
  Accept: "text/csv,*/*",
};

const samples = [];
for (const file of files) {
  const response = await fetch(`${baseUrl}/${file}`, { headers });
  if (!response.ok) throw new Error(`ANP respondeu ${response.status} para ${file}`);
  const parsed = parseAnpCsv(await response.text());
  console.log(`${file}: ${parsed.length} preços`);
  samples.push(...parsed);
}

const summary = summarizeFuelPrices(samples);
await mkdir(values.out, { recursive: true });
const outFile = join(values.out, "fuel-prices.json");
await writeFile(outFile, `${JSON.stringify(summary)}\n`);

const { gasolina, etanol, diesel } = summary.national;
console.log(
  `Semana ${formatAnpWeek(summary.week)}: ${Object.keys(summary.states).length} estados em ${outFile}. ` +
    `Média nacional: gasolina ${gasolina}, etanol ${etanol}, diesel S10 ${diesel}.`,
);
