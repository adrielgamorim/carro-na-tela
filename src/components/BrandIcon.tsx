import type { VehicleCategory } from "../types/vehicle";
import { brandIconUrl, brandLogoUrl } from "./brandIcons";
import { CategoryIcon } from "./CategoryIcon";
import "./BrandIcon.css";

interface BrandIconProps {
  brand: string;
  /** Shown when the brand has no logo. */
  category: VehicleCategory;
  /** Height of the mark; a wide color logo may be up to twice as wide. */
  size?: number;
}

/**
 * The brand's color logo; else its monochrome logo in the text color (an SVG
 * used as a mask, loaded only when shown); else the vehicle type icon.
 */
export function BrandIcon({ brand, category, size = 18 }: BrandIconProps) {
  const logo = brandLogoUrl(brand);
  if (logo) {
    return (
      <img
        className="brand-logo"
        src={logo}
        alt=""
        style={{ maxHeight: size, maxWidth: size * 2 }}
        loading="lazy"
        decoding="async"
      />
    );
  }
  const url = brandIconUrl(brand);
  if (!url) return <CategoryIcon category={category} size={size} />;
  return (
    <span
      className="brand-icon"
      style={{ width: size, height: size, maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")` }}
    />
  );
}
