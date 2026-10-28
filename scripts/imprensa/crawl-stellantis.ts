// Reads the Brazilian press releases of Stellantis (Fiat, Jeep, Citroën,
// Peugeot, RAM…) that may describe a car, and keeps their text in
// data/imprensa/stellantis-releases.jsonl (not committed: rebuild it here).
//
//   npm run crawl:imprensa
//
// Only the release pages, which robots.txt allows; the spec sheet PDFs sit
// behind bot protection and are not fetched. One page every 1.5 s, with a user
// agent that says who is asking; it resumes where it stopped and stops at the
// first 403/429.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { metaContent, releaseText } from "./press.ts";

const sitemap = "https://www.media.stellantis.com/sitemap.br.xml";
const out = "data/imprensa/stellantis-releases.jsonl";
const userAgent = "carro-na-tela/1.0 (pesquisa; github.com/adrielgamorim/carro-na-tela)";
const delayMs = 1500;

/** A release as kept in the cache. */
export interface CachedRelease {
  url: string;
  status: number;
  title: string;
  /** Publication date, YYYY-MM-DD. */
  date: string;
  text: string;
}

// Press rooms of car brands (not the group's corporate news or parts).
const carRooms = /\/br-pt\/(fiat|abarth|jeep|citroen|peugeot|psa-archive|ram|chrysler|dodge|leapmotor)\/press\//;
// Launches, line updates and price lists, or a model's name in the address.
const aboutACar = new RegExp(
  [
    "versao", "versoes", "preco", "ficha", "tecnic", "linha-20", "lanca", "apresenta", "chega",
    "estreia", "porta-malas", "novo-", "nova-", "my20", "ano-modelo", "modelo-20", "strada", "toro",
    "pulse", "fastback", "argo", "cronos", "mobi", "uno", "palio", "siena", "punto", "linea", "bravo",
    "idea", "doblo", "fiorino", "ducato", "freemont", "fiat-500", "500e", "titano", "scudo",
    "renegade", "compass", "commander", "wrangler", "cherokee", "gladiator", "c3", "c4", "aircross",
    "cactus", "jumpy", "jumper", "berlingo", "basalt", "208", "2008", "3008", "5008", "308", "408",
    "207", "partner", "expert", "boxer", "rampage", "ram-", "classic", "durango", "journey", "c10",
    "t03", "b10", "c5", "ds3", "ds4", "ds5", "abarth", "weekend", "stilo", "marea", "tempra",
    "tipo", "elba", "premio", "147", "town-country", "300c", "cruiser", "crossfire", "caravan",
    "neon", "sebring",
  ].join("|"),
);

const headers = { "user-agent": userAgent };
const xml = await fetch(sitemap, { headers }).then((response) => {
  if (!response.ok) throw new Error(`sitemap: ${response.status}`);
  return response.text();
});
const candidates = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => match[1]!.trim())
  .filter((url) => carRooms.test(url) && aboutACar.test(url));

await mkdir("data/imprensa", { recursive: true });
const done = new Set(
  (await readFile(out, "utf8").catch(() => ""))
    .split("\n")
    .filter(Boolean)
    .map((line) => (JSON.parse(line) as CachedRelease).url),
);
const pending = candidates.filter((url) => !done.has(url));
console.log(`${candidates.length} releases sobre carros; ${done.size} já lidos, ${pending.length} a ler`);

let count = 0;
for (const url of pending) {
  const response = await fetch(url, { headers });
  if (response.status === 403 || response.status === 429) {
    throw new Error(`parando: ${response.status} em ${url}`);
  }
  const html = response.ok ? await response.text() : "";
  const release: CachedRelease = {
    url,
    status: response.status,
    title: metaContent(html, "og:title"),
    date: metaContent(html, "article:published_time").slice(0, 10),
    text: html ? releaseText(html) : "",
  };
  await appendFile(out, `${JSON.stringify(release)}\n`);
  if (++count % 50 === 0) console.log(`${count}/${pending.length}`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
console.log(`${count} lidos agora`);
