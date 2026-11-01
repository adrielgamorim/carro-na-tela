// Caches the press releases of Renault and Volkswagen as Stellantis's are
// (npm run crawl:imprensa), for the equipment by version they list
// (npm run extract:equipamentos):
//
//   - Renault: imprensa.renault.com.br/api/releases/public gives all of them,
//     text included, in one request;
//   - Volkswagen: the newsroom's API (newsroom-cms-br.itd.vw.com.br, the one
//     www.vwnews.com.br reads) gives one news item per request, by id, from 1
//     to the newest on its home; one request every 1.5 s, the ones read kept.
//
//   npm run crawl:releases [-- --only=renault|vw]
//
// Writes data/imprensa/{renault,vw}-releases.jsonl (not committed).

import { appendFile, readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { writeFileRetrying } from "../write-file.ts";
import type { CachedRelease } from "./crawl-stellantis.ts";
import { decodeEntities, htmlText } from "./press.ts";

const headers = { "user-agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };
const delayMs = 1500;
const { values } = parseArgs({ options: { only: { type: "string" } } });

async function cached(file: string): Promise<CachedRelease[]> {
  const text = await readFile(file, "utf8").catch(() => "");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CachedRelease);
}

if (values.only !== "vw") {
  const response = await fetch("https://imprensa.renault.com.br/api/releases/public?language=1", { headers });
  if (!response.ok) throw new Error(`${response.status} na lista de releases da Renault`);
  const releases = (await response.json()) as { id: number; release: string; slug: string; text: string; startAt?: string }[];
  const out: CachedRelease[] = releases.map((release) => ({
    url: `https://imprensa.renault.com.br/release/${release.slug}`,
    status: 200,
    title: decodeEntities(release.release),
    date: (release.startAt ?? "").slice(0, 10),
    text: htmlText(release.text ?? ""),
  }));
  await writeFileRetrying("data/imprensa/renault-releases.jsonl", out.map((release) => JSON.stringify(release)).join("\n") + "\n");
  console.log(`Renault: ${out.length} releases`);
}

if (values.only !== "renault") {
  const api = "https://newsroom-cms-br.itd.vw.com.br/v1/api/";
  const file = "data/imprensa/vw-releases.jsonl";
  const done = new Set((await cached(file)).map((release) => release.url));
  const home = (await (await fetch(`${api}home/json/`, { headers })).json()) as { news: { id: number }[] };
  const newest = Math.max(...home.news.map((news) => news.id));
  const pending = Array.from({ length: newest }, (_, at) => newest - at).filter(
    (id) => !done.has(`https://www.vwnews.com.br/news/${id}`),
  );
  console.log(`Volkswagen: ${newest} notícias; ${done.size} já lidas, ${pending.length} a ler`);
  let count = 0;
  const skipped: number[] = [];
  for (const id of pending) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const response = await fetchWithin(`${api}news/json/news/${id}`);
    if (!response) {
      skipped.push(id);
      continue;
    }
    if (response.status === 403 || response.status === 429) throw new Error(`parando: ${response.status} na notícia ${id}`);
    const news = response.ok ? (response.json as VwNews | undefined) : undefined;
    // "16/06/2026"
    const [day, month, year] = (news?.news_date ?? "").split("/");
    const release: CachedRelease = {
      url: `https://www.vwnews.com.br/news/${id}`,
      status: news?.id ? response.status : 404,
      title: decodeEntities(news?.title ?? ""),
      date: year ? `${year}-${month}-${day}` : "",
      text: news?.id ? htmlText([news.description, news.sideDescription].filter(Boolean).join("\n")) : "",
    };
    await appendFile(file, JSON.stringify(release) + "\n");
    if (++count % 100 === 0) console.log(`${count} de ${pending.length}`);
  }
  if (skipped.length) console.log(`Sem resposta (não guardadas, a próxima rodada tenta de novo): ${skipped.join(", ")}`);
}

// About a third of the older news items never answer, always the same ones (2493 held the crawl
// for hours), so each gets one try of 6 s, body included; the others answer in 0.2 s.
async function fetchWithin(url: string): Promise<{ status: number; ok: boolean; json: unknown } | undefined> {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(6_000) });
    const body = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      json = undefined;
    }
    return { status: response.status, ok: response.ok, json };
  } catch {
    return undefined;
  }
}

interface VwNews {
  id: number;
  title: string;
  description: string | null;
  sideDescription: string | null;
  news_date: string;
}
