import { useEffect, useState } from "react";
import { galleryPath } from "../catalog/gallery";
import type { GalleryFile, GalleryPhoto } from "../catalog/gallery";
import { requestJson } from "../services/http";

// A model's photo gallery (public/catalog/galeria), loaded once per model.
// A gallery that fails to load only leaves the page with its main photo.

const galleries = new Map<string, Promise<GalleryPhoto[]>>();

function loadGallery(modelId: string): Promise<GalleryPhoto[]> {
  let promise = galleries.get(modelId);
  if (!promise) {
    promise = requestJson<GalleryFile>("Galeria", `${import.meta.env.BASE_URL}catalog/${galleryPath(modelId)}`, {
      timeoutMs: 15_000,
    })
      .then((file) => file.photos)
      .catch(() => {
        galleries.delete(modelId);
        return [];
      });
    galleries.set(modelId, promise);
  }
  return promise;
}

/** The gallery photos of a model, empty until loaded (or when it has none). */
export function useModelGallery(modelId: string | undefined, hasGallery: boolean): GalleryPhoto[] {
  const [loaded, setLoaded] = useState<{ modelId: string; photos: GalleryPhoto[] } | null>(null);

  useEffect(() => {
    if (!modelId || !hasGallery) return;
    let active = true;
    void loadGallery(modelId).then((photos) => {
      if (active) setLoaded({ modelId, photos });
    });
    return () => {
      active = false;
    };
  }, [modelId, hasGallery]);

  return loaded && loaded.modelId === modelId ? loaded.photos : [];
}
