import type { VehicleCategory } from "../types/vehicle";

export const categories: { id: VehicleCategory; label: string }[] = [
  { id: "cars", label: "Carros" },
  { id: "motorcycles", label: "Motos" },
  { id: "trucks", label: "Caminhões" },
];

export function categoryLabel(category: VehicleCategory): string | undefined {
  return categories.find((item) => item.id === category)?.label;
}
