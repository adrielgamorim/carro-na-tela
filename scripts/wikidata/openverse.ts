// Openverse images (WordPress' index of openly licensed images, which covers
// Flickr's) as the gallery's input (fetch-openverse.ts): only licenses that
// allow showing a photo with credit, the title as its name, the tags as its
// categories, its page on Flickr for the credit link.

import type { CommonsFile } from "./gallery.ts";

/** Openverse's licenses that allow showing a photo with credit, as the gallery names them. */
const licenses: Record<string, string> = {
  by: "CC BY",
  "by-sa": "CC BY-SA",
  "by-nd": "CC BY-ND",
  cc0: "CC0",
  pdm: "Domínio público",
};
export const openverseLicenses = Object.keys(licenses).join(",");

export interface OpenverseImage {
  id: string;
  title?: string | null;
  creator?: string | null;
  license: string;
  license_version?: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
  foreign_landing_url?: string | null;
  source?: string;
  tags?: { name: string }[] | null;
}

/** An Openverse image as the gallery's input; none without a license that allows it or a size. */
export function openverseFile(image: OpenverseImage): CommonsFile | undefined {
  const license = licenses[image.license];
  if (!license || !image.width || !image.height) return undefined;
  return {
    file: `${image.title || "Foto"} (${image.id.slice(0, 8)}).jpg`,
    thumb: image.url,
    width: image.width,
    height: image.height,
    categories: image.tags?.length ? [image.tags.map((tag) => tag.name).join(", ")] : [],
    ...(image.creator && { artist: image.creator.slice(0, 80) }),
    license: [license, image.license_version].filter(Boolean).join(" "),
    ...(image.foreign_landing_url && { page: image.foreign_landing_url }),
  };
}
