// Photo gallery of a model line (Wikimedia Commons, npm run fetch:galeria),
// one file per model in public/catalog/galeria, loaded by the version page.

export type GalleryAngle = "frente" | "traseira" | "lateral" | "interior" | "outra";

export interface GalleryPhoto {
  /** About 960 px wide. */
  thumb: string;
  /** Commons file page (author and license). */
  page: string;
  angle: GalleryAngle;
  /** Model years the photo is shown for. */
  from: number;
  to: number;
  artist?: string;
  license?: string;
}

export interface GalleryFile {
  photos: GalleryPhoto[];
}

export const angleLabels: Record<GalleryAngle, string> = {
  frente: "Frente",
  traseira: "Traseira",
  lateral: "Lateral",
  interior: "Interior",
  outra: "Outra",
};

/** Path of a model's gallery, relative to the catalog folder ("Q107108337"). */
export const galleryPath = (modelId: string) => `galeria/${modelId}.json`;

/** The photos of a model year (0 km counts as this year). */
export function photosOfYear(photos: GalleryPhoto[], modelYear: number | null, now = new Date()) {
  const year = modelYear ?? now.getFullYear();
  return photos.filter((photo) => year >= photo.from && year <= photo.to);
}

/** A bigger Commons thumbnail of the same file, for the enlarged view. */
export const largerThumb = (thumb: string, width: number) => thumb.replace(/\/\d+px-/, `/${width}px-`);
