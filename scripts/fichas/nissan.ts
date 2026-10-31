// Nissan's comparison pages (nissan.com.br/veiculos/modelos/<modelo>/compare.html,
// npm run fichas:sites): every version of a model in the JSON the page's
// script reads ("HELIOS.components.c059D = {"grades": …}"), its figures by
// group ("Motor": "Potência Max. cv @ rpm" = "125 @ 5.000"), its equipment by
// group, each item "Included" (standard) or "Optional", and the years in
// "Ano de produção" ("2026/2027").

import type { EquipmentList } from "./equipment.ts";
import { htmlText } from "./html.ts";
import type { SitePage } from "./kia.ts";
import { litersOf, plain, specsOfFields, transmissionIn, turboIn, valvesIn, words } from "./open-sheets.ts";
import type { OpenSheet } from "./open-sheets.ts";

/** The models nissan.com.br compares, as its paths name them, and their line: the Kicks of 2026 and of 2027. */
export const nissanModels: { slug: string; line: string }[] = [
  { slug: "kait", line: "Kait" },
  { slug: "kicks-my26", line: "Kicks" },
  { slug: "novo-kicks", line: "Kicks" },
  { slug: "versa", line: "Versa" },
];

interface NissanSpec {
  value: string;
  /** The label, for the figures. */
  unit?: string;
  type: string;
}
interface NissanVersion {
  name: string;
  techSpecs: { value: string; specs: (NissanSpec | NissanSpec[])[] }[];
  equipmentSpecs: { value: string; specs: NissanSpec[] }[];
}
interface NissanData {
  grades: Record<string, { versions: Record<string, NissanVersion> }>;
}

// Words of a version's name that are not a trim: "1.6 Advance CVT", "Exclusive 220T".
const notATrim = /^(\d.*|cvt|mt|at)$/;

/** "Potência Max. cv @ rpm" = "125 @ 5.000" → "125 cv": the unit is in the label. */
function withLabelUnit(label: string, value: string): string {
  const unit = plain(label).match(/\b(cv|kgfm|mm|kg)\b/)?.[1];
  const first = value.match(/^\s*(\d+(?:[.,]\d+)*)\s*(?:@|$)/)?.[1];
  return unit && first ? `${first} ${unit}` : value;
}

/** The sheets and equipment lists of a comparison page, a version each. */
export function nissanComparePage(html: string, line: string, source: SitePage): { sheets: OpenSheet[]; lists: EquipmentList[] } {
  const json = html.match(/HELIOS\.components\.\w+ = (\{"grades":.*\});?\s*$/m)?.[1];
  const data = json ? (JSON.parse(json) as NissanData) : { grades: {} };
  const sheets: OpenSheet[] = [];
  const lists: EquipmentList[] = [];
  for (const grade of Object.values(data.grades)) {
    for (const version of Object.values(grade.versions)) {
      const fields = version.techSpecs.flatMap((group) =>
        group.specs.flat().map((spec) => ({ group: group.value, label: htmlText(spec.unit ?? ""), text: htmlText(spec.value) })),
      );
      const valueOf = (pattern: RegExp) => fields.filter(({ label }) => pattern.test(plain(label))).map(({ text }) => text).join(" ");
      const engine = `${valueOf(/^tipo$/)} ${valueOf(/^cilindrada/)} cm³`;
      const fuel = valueOf(/^combustivel$/);
      const electric = /el[eé]tric/i.test(fuel);
      const engineLiters = electric ? undefined : (litersOf(`${valueOf(/^cilindrada/)} cm³`) ?? litersOf(engine));
      const transmission = transmissionIn(valueOf(/^transmissao$/));
      const valves = valvesIn(`${valueOf(/^valvulas$/)} válvulas`);
      const produced = valueOf(/^ano de producao$/).match(/(20\d\d)\s*\/\s*(20\d\d)/);
      const year = Number(source.fetched.slice(0, 4));
      const years: [number, number] = produced ? [Number(produced[1]), Number(produced[2])] : [year, year + 1];
      const name = htmlText(version.name);
      const trims = words(name).filter((word) => !notATrim.test(word));
      const key = {
        brand: "nissan" as const,
        line,
        trims,
        years,
        ...(engineLiters !== undefined && { engineLiters }),
        ...(valves && { valves }),
        ...(!electric && { turbo: turboIn(`${engine} ${name}`) || /\d\.\dt\b/i.test(engine) }),
        electric,
        ...(fuel && { diesel: /diesel/i.test(fuel) }),
        ...(transmission && { transmission }),
      };
      const title = `${line} · ${name}`;
      const specs = specsOfFields(
        fields
          // The newton-metre row repeats the kgfm one.
          .filter(({ label }) => !/\bnm\b/i.test(label))
          .map(({ label, text }) => ({ label, text: withLabelUnit(label, text) })),
      );
      if (Object.keys(specs).length) sheets.push({ ...key, title, page: source.url, url: source.url, file: source.file, specs });
      const groups = version.equipmentSpecs
        .map((group) => ({
          name: htmlText(group.value),
          items: [
            ...new Set(
              group.specs
                .filter((spec) => spec.type === "Included" || spec.type === "Optional")
                .map((spec) => `${htmlText(spec.value)}${spec.type === "Optional" ? " (opcional)" : ""}`),
            ),
          ],
        }))
        .filter((group) => group.items.length);
      if (groups.length) lists.push({ ...key, title, page: source.url, file: source.file, groups });
    }
  }
  return { sheets, lists };
}
