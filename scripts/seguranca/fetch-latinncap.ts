// Latin NCAP's crash test results (latinncap.com/en/results, one page with
// every test), to data/seguranca/latinncap.json.
//
//   npm run fetch:latinncap

import { mkdir } from "node:fs/promises";
import { writeFileRetrying } from "../write-file.ts";
import { crashTests } from "./latinncap.ts";

const url = "https://www.latinncap.com/en/results";
const response = await fetch(url, { headers: { "user-agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" } });
if (!response.ok) throw new Error(`${response.status} em ${url}`);
const tests = crashTests(await response.text());
if (tests.length < 100) throw new Error(`só ${tests.length} testes na página: mudou o formato?`);
await mkdir("data/seguranca", { recursive: true });
await writeFileRetrying(
  "data/seguranca/latinncap.json",
  `${JSON.stringify({ generatedAt: new Date().toISOString(), source: url, tests }, null, 1)}\n`,
);
console.log(`${tests.length} testes da Latin NCAP em data/seguranca/latinncap.json`);
