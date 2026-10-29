// Writes the checklist data/fichas/lista.html: every spec sheet link of
// data/fichas/links.json, by brand and model year, marking the ones already
// read from data/fichas/pdf. Open it in the browser and click to download;
// then npm run fichas:ler moves them in and reads them.
//
//   npm run fichas:lista

import { readdir, readFile } from "node:fs/promises";
import { writeFileRetrying } from "../write-file.ts";
import { checklistOrder, linkOfFile } from "./sheets.ts";
import type { SheetLink, SheetLinksFile } from "./sheets.ts";

const { links, generatedAt } = JSON.parse(await readFile("data/fichas/links.json", "utf8")) as SheetLinksFile;
const files = await readdir("data/fichas/pdf").catch(() => [] as string[]);
const have = new Set(files.flatMap((file) => linkOfFile(file, links)?.id ?? []));

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The site answers with an error for these (checked by hand).
const unavailable = new Set([322]);
const ordered = checklistOrder(links);
const position = new Map(ordered.map((link, index) => [link, index + 1]));
const byBrand = new Map<string, Map<string, SheetLink[]>>();
for (const link of ordered) {
  if (!byBrand.has(link.brand)) byBrand.set(link.brand, new Map());
  const pages = byBrand.get(link.brand)!;
  pages.set(link.pageTitle, [...(pages.get(link.pageTitle) ?? []), link]);
}

const item = (link: SheetLink) => {
  const number = String(position.get(link)).padStart(3, "0");
  const label = `${number}. ${escape(link.title || `Documento ${link.id}`)}`;
  if (unavailable.has(link.id)) return `<li class="gone">${label} (indisponível no site)</li>`;
  return `<li class="${have.has(link.id) ? "have" : ""}"><a href="${escape(link.url)}" target="_blank" rel="noreferrer">${label}</a></li>`;
};
const sections = [...byBrand]
  .map(([brand, pages]) => {
    const items = [...pages]
      .map(([title, list]) => {
        const done = list.filter((link) => have.has(link.id)).length;
        return `<details${done < list.length ? " open" : ""}><summary>${escape(title)} <span>${done}/${list.length}</span></summary><ul>${list.map(item).join("")}</ul></details>`;
      })
      .join("");
    const total = [...pages.values()].flat();
    return `<section><h2>${escape(brand)} <span>${total.filter((link) => have.has(link.id)).length}/${total.length}</span></h2>${items}</section>`;
  })
  .join("");

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fichas técnicas Stellantis</title>
<style>
  :root { color-scheme: light dark; --ink: light-dark(#24332b, #e2eae5); --muted: light-dark(#5d6962, #aab7af);
    --page: light-dark(#f1f4f1, #111714); --card: light-dark(#fff, #19211d); --line: light-dark(#dfe6e1, #2f3b35);
    --good: light-dark(#315c47, #6cc79a); --link: light-dark(#315c47, #8fd3ad); --visited: light-dark(#7a5c9b, #c3a6e6); }
  body { margin: 0; padding: 24px 16px 48px; font: 15px/1.5 system-ui, sans-serif; color: var(--ink); background: var(--page); }
  main { max-width: 860px; margin: 0 auto; }
  h1 { margin: 0 0 6px; font-size: 26px; }
  p { color: var(--muted); margin: 4px 0; }
  code { padding: 1px 5px; border-radius: 4px; background: var(--card); border: 1px solid var(--line); font-size: 13px; }
  section { margin-top: 22px; }
  h2 { font-size: 18px; text-transform: capitalize; border-bottom: 1px solid var(--line); padding-bottom: 4px; }
  h2 span, summary span { color: var(--muted); font-weight: 400; font-size: 14px; }
  details { margin: 6px 0; padding: 8px 12px; background: var(--card); border: 1px solid var(--line); border-radius: 8px; }
  summary { cursor: pointer; font-weight: 600; }
  ul { margin: 8px 0 2px; padding-left: 20px; }
  li { margin: 3px 0; }
  a { color: var(--link); }
  a:visited { color: var(--visited); }
  li.have { list-style: "✓  "; color: var(--good); }
  li.have a { color: var(--good); }
  li.gone { color: var(--muted); text-decoration: line-through; }
</style>
</head>
<body>
<main>
<h1>Fichas técnicas Stellantis</h1>
<p>${links.length} fichas, ${have.size} já lidas (✓). Links listados em ${escape(generatedAt.slice(0, 10))} (npm run fichas:links). Links clicados ficam roxos.</p>
<p>Os números são a ordem da lista: baixe com eles na frente do nome ("053-…pdf") para o leitor saber de qual link veio cada arquivo. Clique para baixar cada ficha. Depois, para mover as baixadas e ler os números:
<code>npm run fichas:ler -- --de="%USERPROFILE%\\Downloads"</code> e <code>npm run fichas:lista</code> para atualizar esta página.</p>
${sections}
</main>
</body>
</html>
`;
await writeFileRetrying("data/fichas/lista.html", html);
console.log(`data/fichas/lista.html: ${links.length} fichas, ${have.size} já lidas`);
