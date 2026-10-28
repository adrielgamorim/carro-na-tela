import { useSyncExternalStore } from "react";

// Versions marked as favorite, kept in this browser (localStorage). Each one
// remembers the FIPE price when it was marked, to show how it moved since.
// A later step may sync them to an account; the shape stays the same.

export interface Favorite {
  /** Catalog entry id: `${brandCode}-${modelCode}:${yearCode}`. */
  id: string;
  /** Shown when the version leaves the catalog. */
  label: string;
  /** When it was marked (ISO date). */
  savedAt: string;
  /** FIPE price then (R$), when known. */
  price: number | null;
  /** FIPE reference month of that price ("outubro de 2026"). */
  reference: string | null;
}

const storageKey = "carro-na-tela:favoritos:v1";
let favorites: Favorite[] | undefined;
const listeners = new Set<() => void>();

function isFavoriteRecord(value: unknown): value is Favorite {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.label === "string" && typeof item.savedAt === "string";
}

function load(): Favorite[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isFavoriteRecord) : [];
  } catch {
    // Blocked or corrupted storage: start empty.
    return [];
  }
}

function save(next: Favorite[]) {
  favorites = next;
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Storage may be blocked; the favorites still work for this visit.
  }
  for (const listener of listeners) listener();
}

/** Newest first. */
export function getFavorites(): Favorite[] {
  favorites ??= load();
  return favorites;
}

/** Marks a version as favorite, or unmarks it. */
export function toggleFavorite(favorite: Omit<Favorite, "savedAt">, now = new Date()) {
  const current = getFavorites();
  save(
    current.some((item) => item.id === favorite.id)
      ? current.filter((item) => item.id !== favorite.id)
      : [{ ...favorite, savedAt: now.toISOString() }, ...current],
  );
}

export function removeFavorite(id: string) {
  save(getFavorites().filter((item) => item.id !== id));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed them.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey) return;
    favorites = load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFavorites(): Favorite[] {
  return useSyncExternalStore(subscribe, getFavorites, getFavorites);
}

/** How much the FIPE price moved since the version was marked; null without both prices. */
export function priceChange(favorite: Favorite, priceNow: number | null | undefined) {
  if (!favorite.price || !priceNow) return null;
  return { difference: priceNow - favorite.price, percent: ((priceNow - favorite.price) / favorite.price) * 100 };
}

/** Test hook: forget the loaded favorites. */
export function resetFavoritesStore() {
  favorites = undefined;
}
