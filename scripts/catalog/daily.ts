// Daily catalog update: crawl:fipe (with every key in .env), fetch:frota
// (Senatran fleet), fetch:wikidata and fetch:wmi (only when a month old),
// build:catalog, then fetch:anp (fuel prices). Output goes to the console and
// to logs/daily-<date>.log.
//
//   npm run daily
//
// Scheduled on Windows by scripts/schedule-daily.ps1. A lock file keeps two
// runs (e.g. a manual one and the scheduled one) from crawling at once.

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const lockFile = join(".cache", "daily.lock");
const date = new Date().toLocaleDateString("sv-SE");
await mkdir("logs", { recursive: true });
const log = createWriteStream(join("logs", `daily-${date}.log`), { flags: "a" });

function write(text: string) {
  process.stdout.write(text);
  log.write(text);
}

function isRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const monthMs = 30 * 24 * 60 * 60 * 1000;

/** True when the file is missing or older than a month. */
async function isStale(file: string) {
  const info = await stat(file).catch(() => null);
  return !info || Date.now() - info.mtimeMs > monthMs;
}

function run(script: string, args: string[] = []) {
  write(`\n> ${script} ${args.join(" ")}\n`);
  return new Promise<number>((resolve) => {
    const child = spawn(
      process.execPath,
      ["--env-file-if-exists=.env", script, ...args],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stdout.on("data", (chunk: Buffer) => write(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => write(chunk.toString()));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const lockPid = Number(await readFile(lockFile, "utf8").catch(() => ""));
if (lockPid && isRunning(lockPid)) {
  write(`${new Date().toISOString()} Outra atualização já está rodando (pid ${lockPid}).\n`);
  process.exit(0);
}
await mkdir(".cache", { recursive: true });
await writeFile(lockFile, String(process.pid));

let exitCode: number;
try {
  write(`\n=== ${new Date().toISOString()} Atualização diária ===\n`);
  const crawl = await run("scripts/catalog/crawl-fipe.ts");
  // Monthly Senatran fleet; downloads only when a new month is out, and a
  // failure keeps the last month's totals.
  const frota = await run("scripts/frota/fetch-frota.ts");
  // Wikidata photos/descriptions and the chassis WMI list change slowly:
  // refreshed once their files are a month old.
  const wikidata = (await isStale("data/wikidata/models.json"))
    ? await run("scripts/wikidata/fetch-wikidata.ts")
    : 0;
  const wmi = (await isStale("public/catalog/wmi.json")) ? await run("scripts/vin/fetch-wmi.ts") : 0;
  // A crawl stopped by the daily limit still writes a snapshot worth indexing.
  const build = await run("scripts/catalog/build-index.ts");
  // Weekly fuel prices; a failure keeps last week's file.
  const anp = await run("scripts/anp/fetch-anp.ts");
  exitCode = crawl || build || anp || frota || wikidata || wmi;
  write(
    `=== ${new Date().toISOString()} Fim (crawl ${crawl}, frota ${frota}, wikidata ${wikidata}, ` +
      `wmi ${wmi}, build ${build}, anp ${anp}) ===\n`,
  );
} finally {
  await rm(lockFile, { force: true });
  log.end();
}
process.exitCode = exitCode;
