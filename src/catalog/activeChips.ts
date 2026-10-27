import type { CatalogFilters } from "./filters";
import {
  bodyLabels,
  formatPrice,
  originLabels,
  propulsionLabels,
  sizeLabels,
  steeringLabels,
  transmissionLabels,
} from "./labels";

// The removable chips above the catalog results, one per active filter value.

export interface ActiveChip {
  key: string;
  label: string;
  remove: Partial<CatalogFilters>;
}

function rangeLabel(
  min: number | null,
  max: number | null,
  format: (value: number) => string,
): string {
  if (min !== null && min === max) return format(min);
  if (min !== null && max !== null) return `${format(min)} a ${format(max)}`;
  if (min !== null) return `a partir de ${format(min)}`;
  return `até ${format(max as number)}`;
}

export function activeChips(filters: CatalogFilters): ActiveChip[] {
  const chips: ActiveChip[] = [];
  const list = <K extends keyof CatalogFilters>(
    facet: K,
    label: (value: string) => string,
  ) => {
    for (const value of filters[facet] as string[]) {
      chips.push({
        key: `${facet}:${value}`,
        label: label(value),
        remove: {
          [facet]: (filters[facet] as string[]).filter((item) => item !== value),
        } as Partial<CatalogFilters>,
      });
    }
  };

  if (filters.query.trim()) {
    chips.push({ key: "query", label: `“${filters.query.trim()}”`, remove: { query: "" } });
  }
  list("brands", (value) => value);
  list("families", (value) => value);
  list("sublines", (value) => value);
  list("propulsions", (value) => propulsionLabels[value as keyof typeof propulsionLabels]);
  list("fuels", (value) => value);
  list("transmissions", (value) => transmissionLabels[value as keyof typeof transmissionLabels]);
  list("bodies", (value) => bodyLabels[value as keyof typeof bodyLabels]);
  list("doors", (value) => `${value} portas`);
  list("sizes", (value) => `Porte ${sizeLabels[value as keyof typeof sizeLabels].toLowerCase()}`);
  list("gears", (value) => `${value} marchas`);
  list("steerings", (value) => `Direção ${steeringLabels[value as keyof typeof steeringLabels].toLowerCase()}`);
  list("origins", (value) => originLabels[value as keyof typeof originLabels]);
  if (filters.consumptionMin !== null) {
    chips.push({
      key: "consumption",
      label: `≥ ${filters.consumptionMin} km/l na cidade`,
      remove: { consumptionMin: null },
    });
  }
  if (filters.airConditioning) {
    chips.push({ key: "ac", label: "Ar-condicionado", remove: { airConditioning: false } });
  }
  if (filters.engineMin !== null || filters.engineMax !== null) {
    chips.push({
      key: "engine",
      label: `Motor ${rangeLabel(filters.engineMin, filters.engineMax, (liters) => liters.toFixed(1))}`,
      remove: { engineMin: null, engineMax: null },
    });
  }
  if (filters.yearMin !== null || filters.yearMax !== null) {
    chips.push({
      key: "year",
      label: `Ano ${rangeLabel(filters.yearMin, filters.yearMax, String)}`,
      remove: { yearMin: null, yearMax: null },
    });
  }
  if (filters.priceMin !== null || filters.priceMax !== null) {
    chips.push({
      key: "price",
      label: rangeLabel(filters.priceMin, filters.priceMax, formatPrice),
      remove: { priceMin: null, priceMax: null },
    });
  }
  if (filters.zeroKmOnly) chips.push({ key: "0km", label: "0 km", remove: { zeroKmOnly: false } });
  if (filters.turbo) chips.push({ key: "turbo", label: "Turbo", remove: { turbo: false } });
  if (filters.fourWheelDrive) {
    chips.push({ key: "4x4", label: "4x4", remove: { fourWheelDrive: false } });
  }
  return chips;
}
