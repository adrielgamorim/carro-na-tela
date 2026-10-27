import { Bike, CarFront, Truck } from "lucide-react";
import type { VehicleCategory } from "../types/vehicle";

interface CategoryIconProps {
  category: VehicleCategory;
  size?: number;
}

export function CategoryIcon({ category, size = 18 }: CategoryIconProps) {
  if (category === "cars") return <CarFront size={size} />;
  if (category === "motorcycles") return <Bike size={size} />;
  return <Truck size={size} />;
}
