import type { VehicleCategory } from "../types/vehicle";
import { brandIconUrl } from "./brandIcons";
import { CategoryIcon } from "./CategoryIcon";
import "./BrandIcon.css";

interface BrandIconProps {
  brand: string;
  /** Shown when the brand has no logo. */
  category: VehicleCategory;
  size?: number;
}

/**
 * The brand's logo in the text color (an SVG used as a mask, loaded only when
 * shown), else the vehicle type icon.
 */
export function BrandIcon({ brand, category, size = 18 }: BrandIconProps) {
  const url = brandIconUrl(brand);
  if (!url) return <CategoryIcon category={category} size={size} />;
  return (
    <span
      className="brand-icon"
      style={{ width: size, height: size, maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")` }}
    />
  );
}
