// The equipment lists taken from press releases and reviewed by hand
// (data/imprensa/equipamentos.json, see npm run extract:equipamentos), as
// equipment lists of the catalog (npm run fichas:abertas). A version that
// adds to another has that one's items too.

import type { EquipmentList } from "../fichas/equipment.ts";
import type { SheetKey } from "../fichas/open-sheets.ts";

/** One version of a release, reviewed. */
export interface ReleaseList extends Omit<SheetKey, "electric"> {
  /** The release's URL and the version's words: "https://…#argo-drive-1-0". */
  key: string;
  electric?: boolean;
  /** "Argo · Drive 1.0 (release 2020-09)" */
  title: string;
  /** The release. */
  page: string;
  /** The key of the version it adds to ("todos os itens da versão Live Go, mais:"). */
  addsTo?: string;
  items: string[];
  optional: string[];
}

export interface ReleaseEquipmentFile {
  _doc?: string;
  lists: ReleaseList[];
  /** Keys of the versions whose drafts were wrong or are not equipment (a sale's conditions). */
  rejected: string[];
}

export const releaseGroup = "Itens citados no release";

/** The lists, each with its base's items (and that one's base's) first, as the press room's last: only where no list fits. */
export function releaseEquipment(file: ReleaseEquipmentFile): EquipmentList[] {
  const byKey = new Map(file.lists.map((list) => [list.key, list]));
  const itemsOf = (list: ReleaseList, seen = new Set<string>()): { items: string[]; optional: string[] } => {
    const base = list.addsTo && !seen.has(list.addsTo) ? byKey.get(list.addsTo) : undefined;
    const inherited = base ? itemsOf(base, seen.add(list.key)) : { items: [], optional: [] };
    const items = [...new Set([...inherited.items, ...list.items])];
    // An option of the base may be standard here.
    const optional = [...new Set([...inherited.optional, ...list.optional])].filter((item) => !items.includes(item));
    return { items, optional };
  };
  return file.lists.map((list) => {
    const { key, addsTo, items: own, optional: ownOptional, electric, ...sheet } = list;
    void key;
    void addsTo;
    void own;
    void ownOptional;
    const { items, optional } = itemsOf(list);
    return {
      ...sheet,
      electric: electric ?? false,
      fallback: true,
      file: list.page,
      groups: [{ name: releaseGroup, items: [...items, ...optional.map((item) => `${item} (opcional)`)] }],
    };
  });
}
