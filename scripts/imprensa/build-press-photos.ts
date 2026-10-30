// Prepares the press photos the brands allowed us to show (see
// data/imprensa/fotos/LEIA-ME.md): each one, 1280 px wide at most, to
// public/catalog/imprensa/<marca>/ (committed), and the list of them, with
// model, years, angle and credit, to data/imprensa/fotos.json, which
// build:catalog puts first in the models' galleries.
//
//   npm run fotos:imprensa
//   npm run fotos:imprensa -- --previa   (only says what it would take, by brand)
//
// A photo without a year in its name goes to the model's newest generation
// (the span of its newest Commons photos). Not taken: photos under 600 px wide,
// copies of another (same bytes), and the ones whose name says racing, a logo,
// an event (notACarOnSale). Needs public/catalog/index.json (npm run
// build:catalog) for the models.

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { writeFileRetrying } from "../write-file.ts";
import type { GalleryPhoto } from "../wikidata/gallery.ts";
import { namesBrand, notACarOnSale, pressAngle, pressFileName, pressModel, pressYears } from "./press-photos.ts";
import type { PressAuthorization, PressModel } from "./press-photos.ts";

const sourceDir = "data/imprensa/fotos";
const outDir = "public/catalog/imprensa";
const image = /\.(jpe?g|png|webp|tiff?)$/i;
const minWidth = 600;
const { values } = parseArgs({ options: { previa: { type: "boolean" } } });

export interface PressPhoto extends Omit<GalleryPhoto, "file"> {
  model: string;
  /** Where it came from in data/imprensa/fotos. */
  source: string;
  /** "Sala de imprensa da Renault" */
  site: string;
}

interface Index {
  brands: { name: string }[];
  models: PressModel[];
  versions: { b: number; w?: number }[];
}
const index = JSON.parse(await readFile("public/catalog/index.json", "utf8")) as Index;

// Each model's newest generation, by its Commons photos; without them, the last few years.
const commons = await readFile("data/wikidata/gallery.json", "utf8")
  .then((text) => JSON.parse(text) as Record<string, { from: number; to: number }[]>)
  .catch(() => ({}) as Record<string, { from: number; to: number }[]>);
const thisYear = new Date().getFullYear();
function newestSpan(model: string): [number, number] {
  const newest = (commons[model] ?? []).reduce<{ from: number; to: number } | undefined>(
    (best, photo) => (!best || photo.from > best.from ? photo : best),
    undefined,
  );
  if (!newest) return [thisYear - 2, thisYear + 1];
  // A line still sold: through next year's models too. An old one (the 147 of an anniversary): its last generation's.
  return [newest.from, newest.to >= thisYear - 1 ? Math.max(newest.to, thisYear + 1) : newest.to];
}

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)])),
  );
  return nested.flat();
}

const photos: PressPhoto[] = [];
const notes: string[] = [];
const seen = new Set<string>();
const written = new Set<string>();
let resized = 0;
const folders = (await readdir(sourceDir, { withFileTypes: true }).catch(() => [])).filter(
  (entry) => entry.isDirectory() && !entry.name.startsWith("_"),
);
for (const { name: folder } of folders) {
  const brandDir = join(sourceDir, folder);
  const authorization = await readFile(join(brandDir, "autorizacao.json"), "utf8")
    .then((text) => JSON.parse(text) as PressAuthorization)
    .catch(() => undefined);
  const allowed = Boolean(authorization?.credito && authorization.link);
  const brand = index.brands.findIndex((item) => namesBrand(folder, item.name));
  if (brand < 0) {
    notes.push(`${folder}: nenhuma marca da FIPE com esse nome`);
    continue;
  }
  const modelIds = new Set(
    index.versions.filter((version) => version.b === brand && version.w !== undefined).map((version) => version.w!),
  );
  const models = [...modelIds].map((id) => index.models[id]!);
  const brandName = index.brands[brand]!.name.split(" - ").at(-1)!;
  const brandSlug = pressFileName(folder).replace(/\.webp$/, "");

  const counts = { taken: 0, withYear: 0, noModel: 0, notACar: 0, small: 0, copies: 0 };
  const unknown = new Map<string, number>();
  for (const path of (await filesUnder(brandDir)).filter((file) => image.test(file))) {
    const source = relative(brandDir, path).replace(/\\/g, "/");
    if (notACarOnSale(source)) {
      counts.notACar++;
      continue;
    }
    const model = pressModel(source, models);
    if (!model) {
      counts.noModel++;
      // "00012-Fiat-Pulse-…": the word after the brand's is the line the download named.
      const named = source.split("-")[2] ?? source;
      unknown.set(named, (unknown.get(named) ?? 0) + 1);
      continue;
    }
    const bytes = await readFile(path);
    const hash = createHash("sha1").update(bytes).digest("hex");
    if (seen.has(hash)) {
      counts.copies++;
      continue;
    }
    seen.add(hash);
    const { width = 0 } = await sharp(bytes)
      .metadata()
      .catch(() => ({ width: 0 }));
    if (width < minWidth) {
      counts.small++;
      continue;
    }
    const named = pressYears(source);
    if (named) counts.withYear++;
    counts.taken++;
    if (values.previa || !allowed || !authorization) continue;

    const years = named ?? newestSpan(model.id);
    const name = pressFileName(source);
    const target = join(outDir, brandSlug, name);
    written.add(target);
    const done = await stat(target).catch(() => undefined);
    if (!done || done.mtimeMs < (await stat(path)).mtimeMs) {
      await mkdir(join(outDir, brandSlug), { recursive: true });
      // Upright by its EXIF, 1280 px wide at most.
      await writeFileRetrying(
        target,
        await sharp(bytes).rotate().resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      );
      resized++;
    }
    photos.push({
      model: model.id,
      thumb: `imprensa/${brandSlug}/${name}`,
      angle: pressAngle(source.split("/").pop()!),
      from: years[0],
      to: years[1],
      artist: authorization.credito,
      page: authorization.link,
      site: `Sala de imprensa da ${brandName}`,
      source: `${folder}/${source}`,
    });
  }
  const top = [...unknown].sort((a, b) => b[1] - a[1]).slice(0, 12);
  notes.push(
    `${folder}${allowed ? "" : " (sem autorizacao.json: não entra)"}: ${counts.taken} fotos (${counts.withYear} com ano no nome); ` +
      `fora: ${counts.noModel} sem modelo reconhecido, ${counts.notACar} de corrida/evento/logo, ${counts.small} pequenas, ${counts.copies} repetidas` +
      (top.length ? `\n    sem modelo: ${top.map(([name, count]) => `${name} (${count})`).join(", ")}` : ""),
  );
}
console.log(notes.join("\n"));
if (values.previa) process.exit(0);

// Photos taken out of the folders leave the site too.
for (const file of await filesUnder(outDir).catch(() => [] as string[])) {
  if (!written.has(file)) await rm(file);
}
// The fronts first, as in the Commons galleries.
const order = ["frente", "lateral", "traseira", "interior", "outra"];
photos.sort(
  (a, b) => a.model.localeCompare(b.model) || a.from - b.from || order.indexOf(a.angle) - order.indexOf(b.angle),
);
await writeFileRetrying(
  "data/imprensa/fotos.json",
  `${JSON.stringify({ _doc: "Fotos de imprensa autorizadas pelas marcas (npm run fotos:imprensa), em public/catalog/imprensa.", photos }, null, 1)}\n`,
);
console.log(
  `${photos.length} fotos de imprensa (${resized} redimensionadas agora) de ${new Set(photos.map((photo) => photo.model)).size} modelos`,
);
