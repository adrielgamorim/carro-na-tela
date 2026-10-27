import type { FipeVehicle } from "../types/vehicle";

const sessionKey = "carro-na-tela:session:v1";
const maxComparison = 4;

export interface StoredSession {
  consulted: FipeVehicle[];
  comparison: FipeVehicle[];
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): KeyValueStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isVehicle(value: unknown): value is FipeVehicle {
  if (typeof value !== "object" || value === null) return false;
  const vehicle = value as Record<string, unknown>;

  return (
    typeof vehicle.id === "string" &&
    typeof vehicle.category === "string" &&
    typeof vehicle.brand === "string" &&
    typeof vehicle.model === "string" &&
    typeof vehicle.codeFipe === "string" &&
    typeof vehicle.yearCode === "string" &&
    typeof vehicle.modelYear === "number" &&
    typeof vehicle.price === "string" &&
    typeof vehicle.priceValue === "number" &&
    typeof vehicle.referenceCode === "string"
  );
}

export function loadSession(
  storage: KeyValueStorage | undefined = defaultStorage(),
): StoredSession {
  const empty: StoredSession = { consulted: [], comparison: [] };

  try {
    const raw = storage?.getItem(sessionKey);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as {
      consulted?: unknown;
      comparisonIds?: unknown;
    };
    const consulted = Array.isArray(parsed.consulted)
      ? parsed.consulted.filter(isVehicle)
      : [];
    const comparisonIds = Array.isArray(parsed.comparisonIds)
      ? parsed.comparisonIds.filter((id) => typeof id === "string")
      : [];
    const comparison = comparisonIds
      .map((id) => consulted.find((vehicle) => vehicle.id === id))
      .filter((vehicle) => vehicle !== undefined)
      .slice(0, maxComparison);

    return { consulted, comparison };
  } catch {
    return empty;
  }
}

export function saveSession(
  session: StoredSession,
  storage: KeyValueStorage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(
      sessionKey,
      JSON.stringify({
        consulted: session.consulted,
        comparisonIds: session.comparison.map((vehicle) => vehicle.id),
      }),
    );
  } catch {
    // Storage may be full or blocked; persistence is a convenience only.
  }
}
