// More gallery photos from Flickr, through Openverse (api.openverse.org, the
// open index of Creative Commons images): one search per model line by its
// name ("Chevrolet Onix"), only licenses that allow showing a photo with
// credit, picked like the Commons photos (name, angle, year, generation, body
// style; no racing, taxis or toys). build:catalog adds them where Commons
// leaves a generation short.
//
//   npm run fetch:openverse
//   LIMIT=20 npm run fetch:openverse   (the first 20 models, to try)
//
// Anonymous searches have a daily limit; with OPENVERSE_CLIENT_ID and
// OPENVERSE_CLIENT_SECRET in .env (a free registration) it is higher. Answers
// are cached in .cache/openverse, so a run cut short by the limit (or by
// the service's time-outs) goes on where it stopped. Writes
// data/wikidata/openverse.json.

import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeFileRetrying } from "../write-file.ts";
import { pickGallery } from "./gallery.ts";
import type { GalleryPhoto } from "./gallery.ts";
import { openverseFile, openverseLicenses } from "./openverse.ts";
import type { OpenverseImage } from "./openverse.ts";
import type { ModelGeneration } from "./generations.ts";
import type { CatalogIndexFile } from "../../src/catalog/indexFormat.ts";

const api = "https://api.openverse.org/v1";
const cacheDir = ".cache/openverse";
const out = "data/wikidata/openverse.json";
const headers: Record<string, string> = { "user-agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// With a registered client, a token for higher limits.
const clientId = process.env.OPENVERSE_CLIENT_ID?.trim();
const clientSecret = process.env.OPENVERSE_CLIENT_SECRET?.trim();
if (clientId && clientSecret) {
  const response = await fetch(`${api}/auth_tokens/token/`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
  });
  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) throw new Error(`Openverse não deu o token (${response.status}); confira o cadastro e o e-mail de verificação.`);
  headers.authorization = `Bearer ${token.access_token}`;
} else {
  console.log("Sem OPENVERSE_CLIENT_ID/OPENVERSE_CLIENT_SECRET no .env: buscas anônimas, com limite diário menor.");
}

class Stop extends Error {}

/** A model's search, from the cache or Openverse; Stop when the day's limit is reached or the service keeps failing. */
async function search(label: string, id: string): Promise<OpenverseImage[]> {
  const cached = join(cacheDir, `${id}.json`);
  const known = await readFile(cached, "utf8").catch(() => undefined);
  if (known) return JSON.parse(known) as OpenverseImage[];
  const params = new URLSearchParams({ q: label, license: openverseLicenses, source: "flickr", page_size: "20", mature: "false" });
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(attempt === 1 ? 1500 : 20_000 * attempt);
    const response = await fetch(`${api}/images/?${params}`, { headers }).catch(() => undefined);
    if (response?.status === 429) throw new Stop("limite de buscas do Openverse atingido");
    if (!response?.ok) continue;
    const body = (await response.json()) as { results?: OpenverseImage[] };
    const images = body.results ?? [];
    await writeFileRetrying(cached, JSON.stringify(images));
    return images;
  }
  throw new Stop("o Openverse não respondeu (tempo esgotado)");
}

await mkdir(cacheDir, { recursive: true });
const index = JSON.parse(await readFile("public/catalog/index.json", "utf8")) as CatalogIndexFile;
const generations = JSON.parse(await readFile("data/wikidata/generations.json", "utf8")) as Record<string, ModelGeneration[]>;
// Lines with the fewest Commons photos first: a run cut short still helps where it matters.
const commons = await readFile("data/wikidata/gallery.json", "utf8")
  .then((text) => JSON.parse(text) as Record<string, GalleryPhoto[]>)
  .catch(() => ({}) as Record<string, GalleryPhoto[]>);
const models = [...(index.models ?? [])]
  .sort((a, b) => (commons[a.id]?.length ?? 0) - (commons[b.id]?.length ?? 0))
  .slice(0, Number(process.env.LIMIT ?? Infinity));

// The oldest model year of each model's versions in the catalog (0 km counts as this year).
const firstYearOf = new Map<string, number>();
for (const version of index.versions) {
  const model = version.w === undefined ? undefined : index.models?.[version.w];
  if (!model) continue;
  const years = version.y.map(([yearCode]) => Number(yearCode.split("-")[0])).filter((year) => year < 3000);
  if (years.length) firstYearOf.set(model.id, Math.min(firstYearOf.get(model.id) ?? Infinity, ...years));
}

const gallery: Record<string, GalleryPhoto[]> = {};
let searched = 0;
let stopped = "";
for (const model of models) {
  let images: OpenverseImage[];
  try {
    images = await search(model.label, model.id.replace(/[^\w-]+/g, "_"));
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    stopped = error.message;
    break;
  }
  searched++;
  const files = images.flatMap((image) => openverseFile(image) ?? []);
  const picked = pickGallery(files, { label: model.label, generations: generations[model.id], firstYear: firstYearOf.get(model.id) });
  if (picked.length) gallery[model.id] = picked;
  if (searched % 25 === 0) console.log(`${searched}/${models.length} modelos (${Object.keys(gallery).length} com fotos)`);
}

await writeFileRetrying(out, `${JSON.stringify(gallery, null, 1)}\n`);
const total = Object.values(gallery).flat().length;
console.log(`${Object.keys(gallery).length} modelos com fotos do Flickr (via Openverse), ${total} fotos em ${out}`);
if (stopped) console.log(`Parou em ${searched} de ${models.length} modelos: ${stopped}. Rode de novo depois; o cache guarda o que já veio.`);
