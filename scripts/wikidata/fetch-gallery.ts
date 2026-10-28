// Gathers a photo gallery per model line from Wikimedia Commons and writes
// data/wikidata/gallery.json (committed): for each Wikidata model of the
// catalog, its Commons category (P373) and up to two levels of
// subcategories (generations, body styles), then a few photos per
// generation from different angles (scripts/wikidata/gallery.ts).
//
//   npm run fetch:galeria
//
// Wikimedia limits clients without an account to about 10 requests a minute
// (fewer on a shared IP); with a bot password in .env (WIKIMEDIA_BOT_USER and
// WIKIMEDIA_BOT_PASSWORD, from Special:BotPasswords) the limit is ~200. Either
// way: one request at a time, a pause that grows on every 429/503 (and its
// Retry-After), and each answer cached in .cache/galeria, so a stopped run
// resumes.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CatalogIndexFile } from "../../src/catalog/indexFormat.ts";
import type { ModelGeneration } from "./generations.ts";
import { isNotTheCar, pickGallery, recencyHint, subcategoryRank } from "./gallery.ts";
import type { CommonsFile, GalleryPhoto } from "./gallery.ts";

const cacheDir = ".cache/galeria";
const out = "data/wikidata/gallery.json";
const commons = "commons.wikimedia.org";
const headers = { "User-Agent": "carro-na-tela/1.0 (https://github.com/adrielgamorim/carro-na-tela)" };
// Some lines nest photos deep: generation → body style → market (Toyota Corolla).
const maxDepth = 3;
const maxCategoriesPerModel = 14;
// Searches of a whole generation's tree per model, when the walk found little there.
const deepSearches = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Session cookies of the bot password login, sent with every Commons request.
const cookies = new Map<string, string>();
function keepCookies(response: Response) {
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";")[0] ?? "";
    const equals = pair.indexOf("=");
    if (equals > 0) cookies.set(pair.slice(0, equals).trim(), pair.slice(equals + 1));
  }
}
const cookieHeader = () => [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");

/** Logs in with a bot password; throws when Wikimedia refuses it. */
async function login(user: string, password: string) {
  const tokenResponse = await fetch(
    `https://${commons}/w/api.php?action=query&meta=tokens&type=login&format=json&formatversion=2`,
    { headers },
  );
  keepCookies(tokenResponse);
  const { query } = (await tokenResponse.json()) as { query: { tokens: { logintoken: string } } };
  const response = await fetch(`https://${commons}/w/api.php`, {
    method: "POST",
    headers: { ...headers, Cookie: cookieHeader(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action: "login",
      lgname: user,
      lgpassword: password,
      lgtoken: query.tokens.logintoken,
      format: "json",
      formatversion: "2",
    }),
  });
  keepCookies(response);
  const { login: result } = (await response.json()) as { login: { result: string; reason?: string } };
  if (result.result !== "Success") {
    throw new Error(`Login no Wikimedia recusado (${result.result}): ${result.reason ?? "confira o .env"}`);
  }
}

const botUser = process.env.WIKIMEDIA_BOT_USER?.trim();
const botPassword = process.env.WIKIMEDIA_BOT_PASSWORD?.trim();
const loggedIn = Boolean(botUser && botPassword);
if (botUser && botPassword) {
  await login(botUser, botPassword);
  console.log(`Logado no Wikimedia como ${botUser.split("@")[0]}`);
} else {
  console.log("Sem WIKIMEDIA_BOT_USER/WIKIMEDIA_BOT_PASSWORD no .env: indo devagar, sem conta.");
}
// About 100 requests a minute logged in (half the limit); 10 without an account.
let pauseMs = loggedIn ? 600 : 7000;

/** One API answer, from the cache or the network (politely). */
async function api<T>(host: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const cacheFile = join(cacheDir, `${createHash("sha1").update(`${host}?${query}`).digest("hex")}.json`);
  const cached = await readFile(cacheFile, "utf8").catch(() => null);
  if (cached) return JSON.parse(cached) as T;
  // Logged in, every Commons request checks the session is still on.
  const withSession = loggedIn && host === commons;
  if (withSession) query.set("assert", "user");
  for (let attempt = 0; ; attempt++) {
    await sleep(pauseMs);
    const response = await fetch(`https://${host}/w/api.php?${query}`, {
      headers: withSession ? { ...headers, Cookie: cookieHeader() } : headers,
    });
    if (response.ok) {
      keepCookies(response);
      const text = await response.text();
      const error = (JSON.parse(text) as { error?: { code: string } }).error;
      if (!error) {
        await writeFile(cacheFile, text);
        return JSON.parse(text) as T;
      }
      // The session expired: log in again and repeat the request.
      if (error.code === "assertuserfailed" && botUser && botPassword && attempt < 8) {
        console.log("  sessão expirou: entrando de novo");
        cookies.clear();
        await login(botUser, botPassword);
        continue;
      }
      // A database or server hiccup on Wikimedia's side ("internal_api_error_DBConnectionError",
      // "maxlag", "readonly", a busy search): wait and try again, like a 503.
      if (/^(internal_api_error|maxlag|readonly|ratelimited)|too-busy/.test(error.code) && attempt < 8) {
        const wait = 15 * (attempt + 1);
        console.log(`  ${error.code}: esperando ${wait} s`);
        await sleep(wait * 1000);
        continue;
      }
      throw new Error(`${host}: ${error.code}`);
    }
    if ((response.status === 429 || response.status === 503) && attempt < 8) {
      const wait = Number(response.headers.get("retry-after") ?? 30);
      pauseMs = Math.min(Math.max(pauseMs * 1.5, 1000), 20_000);
      console.log(`  ${response.status}: esperando ${wait} s (pausa agora ${(pauseMs / 1000).toFixed(1)} s)`);
      await sleep(wait * 1000);
      continue;
    }
    throw new Error(`${host}: ${response.status}`);
  }
}

await mkdir(cacheDir, { recursive: true });
const index = JSON.parse(await readFile("public/catalog/index.json", "utf8")) as CatalogIndexFile;
const generations = JSON.parse(await readFile("data/wikidata/generations.json", "utf8")) as Record<string, ModelGeneration[]>;
// LIMIT=n fetches only the first n models (to try the script).
const models = (index.models ?? [])
  .filter((model) => /^Q\d+$/.test(model.id))
  .slice(0, Number(process.env.LIMIT ?? Infinity));

// Commons category (P373) of each model, 50 per request.
const categoryOf = new Map<string, string>();
for (let start = 0; start < models.length; start += 50) {
  const ids = models.slice(start, start + 50).map((model) => model.id);
  const result = await api<{ entities: Record<string, { claims?: { P373?: { mainsnak: { datavalue?: { value: string } } }[] } }> }>(
    "www.wikidata.org",
    { action: "wbgetentities", ids: ids.join("|"), props: "claims" },
  );
  for (const id of ids) {
    const category = result.entities[id]?.claims?.P373?.[0]?.mainsnak.datavalue?.value;
    if (category) categoryOf.set(id, category);
  }
}
console.log(`${categoryOf.size} de ${models.length} modelos têm categoria no Commons`);

interface Member {
  ns: number;
  title: string;
  imageinfo?: { thumburl?: string; width: number; height: number }[];
  categories?: { title: string }[];
}

/** The photo files of an API page list, with their size and visible categories. */
function photoFiles(pages: Member[]): CommonsFile[] {
  const files: CommonsFile[] = [];
  for (const member of pages) {
    const info = member.imageinfo?.[0];
    if (member.ns === 6 && info?.thumburl && /\.(jpe?g|png|webp)$/i.test(member.title)) {
      files.push({
        file: member.title.replace(/^File:/, ""),
        thumb: info.thumburl,
        width: info.width,
        height: info.height,
        categories: (member.categories ?? []).map((item) => item.title.replace(/^Category:/, "")),
      });
    }
  }
  return files;
}

/** Files and subcategories of a category (up to 200 files). */
async function members(category: string) {
  const files: CommonsFile[] = [];
  const subcategories: string[] = [];
  let next: Record<string, string> = {};
  for (let page = 0; page < 4; page++) {
    const result = await api<{ query?: { pages: Member[] }; continue?: Record<string, string> }>(commons, {
      action: "query",
      generator: "categorymembers",
      gcmtitle: `Category:${category}`,
      gcmtype: "file|subcat",
      gcmlimit: "50",
      prop: "imageinfo|categories",
      iiprop: "url|size",
      iiurlwidth: "960",
      clshow: "!hidden",
      cllimit: "max",
      ...next,
    });
    const pages = result.query?.pages ?? [];
    for (const member of pages) {
      if (member.ns === 14) subcategories.push(member.title.replace(/^Category:/, ""));
    }
    files.push(...photoFiles(pages));
    if (!result.continue) break;
    next = result.continue;
  }
  return { files, subcategories };
}

/**
 * Photos anywhere under a category, however deep (Commons search "deepcat:"),
 * in one request: for generations whose photos sit below body styles and
 * markets (Toyota Corolla (E210) → sedan → Corolla Altis (E210)).
 */
async function deepPhotos(category: string): Promise<CommonsFile[]> {
  const result = await api<{ query?: { pages: Member[] } }>(commons, {
    action: "query",
    generator: "search",
    gsrsearch: `deepcat:"${category}" filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "50",
    prop: "imageinfo|categories",
    iiprop: "url|size",
    iiurlwidth: "960",
    clshow: "!hidden",
    cllimit: "max",
  });
  return photoFiles(result.query?.pages ?? []).map((file) => ({ ...file, subcategory: category }));
}

/** Author and license of the chosen files, 50 per request. */
async function credits(files: string[]) {
  const found = new Map<string, { artist?: string; license?: string }>();
  for (let start = 0; start < files.length; start += 50) {
    const titles = files.slice(start, start + 50).map((file) => `File:${file}`);
    const result = await api<{
      query?: {
        pages: { title: string; imageinfo?: { extmetadata?: Record<string, { value: string }> }[] }[];
        normalized?: { from: string; to: string }[];
      };
    }>(commons, {
      action: "query",
      titles: titles.join("|"),
      prop: "imageinfo",
      iiprop: "extmetadata",
      iiextmetadatafilter: "Artist|LicenseShortName",
    });
    for (const page of result.query?.pages ?? []) {
      const meta = page.imageinfo?.[0]?.extmetadata ?? {};
      const artist = meta.Artist?.value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      found.set(page.title.replace(/^File:/, ""), {
        ...(artist && { artist: artist.slice(0, 80) }),
        ...(meta.LicenseShortName?.value && { license: meta.LicenseShortName.value }),
      });
    }
  }
  return found;
}

// The oldest model year of each model's versions in the catalog (0 km counts as this year).
const firstYearOf = new Map<string, number>();
for (const version of index.versions) {
  const model = version.w === undefined ? undefined : index.models?.[version.w];
  if (!model) continue;
  const years = version.y.map(([yearCode]) => Number(yearCode.split("-")[0])).filter((year) => year < 3000);
  if (!years.length) continue;
  firstYearOf.set(model.id, Math.min(firstYearOf.get(model.id) ?? Infinity, ...years));
}

const gallery: Record<string, GalleryPhoto[]> = {};
let done = 0;
for (const model of models) {
  const root = categoryOf.get(model.id);
  if (!root) continue;
  // The newest generation and its body styles and interiors first, then the
  // next generation; the line's sibling models ("Corolla Verso", "Corolla
  // Axio") only with room to spare. Each subcategory goes with the generation
  // (depth 1) it hangs from.
  type Step = {
    category: string;
    depth: number;
    rank: number;
    recency: number;
    branch: [number, number];
    /** The generation (depth 1) it hangs from. */
    top?: string;
  };
  const files: CommonsFile[] = [];
  const queue: Step[] = [{ category: root, depth: 0, rank: 0, recency: 0, branch: [0, Infinity] }];
  const visited = new Set<string>();
  const generationsFound: { category: string; recency: number }[] = [];
  const filesUnder = new Map<string, number>();
  while (queue.length && visited.size < maxCategoriesPerModel) {
    queue.sort(
      (a, b) =>
        a.branch[0] - b.branch[0] ||
        b.branch[1] - a.branch[1] ||
        a.depth - b.depth ||
        a.rank - b.rank ||
        b.recency - a.recency,
    );
    const step = queue.shift()!;
    if (visited.has(step.category)) continue;
    visited.add(step.category);
    const found = await members(step.category);
    files.push(...found.files.map((file) => (step.depth ? { ...file, subcategory: step.category } : file)));
    if (step.top) filesUnder.set(step.top, (filesUnder.get(step.top) ?? 0) + found.files.length);
    if (step.depth < maxDepth) {
      for (const sub of found.subcategories) {
        if (isNotTheCar(sub)) continue;
        const rank = subcategoryRank(step.category, sub);
        const recency = recencyHint(step.category, sub);
        if (step.depth === 0 && rank === 0) generationsFound.push({ category: sub, recency });
        queue.push({
          category: sub,
          depth: step.depth + 1,
          rank,
          recency,
          branch: step.depth === 0 ? [rank, recency] : step.branch,
          top: step.depth === 0 ? sub : step.top,
        });
      }
    }
  }
  // The newest generations the walk found few photos in: search their whole tree.
  const sparse = generationsFound
    .sort((a, b) => b.recency - a.recency)
    .slice(0, deepSearches)
    .filter(({ category }) => (filesUnder.get(category) ?? 0) < 10);
  for (const { category } of sparse) {
    // A complement: when the search stays busy, the walk's photos are enough.
    const found = await deepPhotos(category).catch((error: unknown) => {
      console.log(`  busca em ${category} falhou: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    });
    files.push(...found);
  }
  const photos = pickGallery(files, {
    label: model.label,
    generations: generations[model.id],
    firstYear: firstYearOf.get(model.id),
  });
  if (photos.length) gallery[model.id] = photos;
  if (++done % 25 === 0) console.log(`${done}/${categoryOf.size} modelos (${Object.keys(gallery).length} com galeria)`);
}

const credited = await credits([...new Set(Object.values(gallery).flat().map((photo) => photo.file))]);
for (const photos of Object.values(gallery)) {
  for (const photo of photos) Object.assign(photo, credited.get(photo.file.replace(/_/g, " ")) ?? credited.get(photo.file));
}
await writeFile(out, `${JSON.stringify(gallery, null, 1)}\n`);
const total = Object.values(gallery).flat().length;
console.log(`${Object.keys(gallery).length} modelos com galeria, ${total} fotos em ${out}`);
