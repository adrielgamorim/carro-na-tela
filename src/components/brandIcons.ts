// Brand marks the app shows. A color logo (public/brands/logos/<key>.png, from
// npm run fetch:brand-logos) when there is one; else the brand's monochrome
// icon from Simple Icons (CC0), served as public/brands/<key>.svg by
// npm run build:brand-icons. Several car makers asked Simple Icons to remove
// theirs (Mercedes-Benz, BYD, Land Rover, Jaguar…), so those have only the
// color logo.

import { brandIconKeys } from "./brandIconKeys.ts";
import { brandLogoKeys } from "./brandLogoKeys.ts";

const available = new Set(brandIconKeys);
const withLogo = new Set(brandLogoKeys);

// FIPE names that are not the brand's plain name.
const aliases: Record<string, string> = {
  gmchevrolet: "chevrolet",
  vwvolkswagen: "volkswagen",
  kiamotors: "kia",
  yamahamotor: "yamaha",
  caoachery: "chery",
  caoacherychery: "chery",
  caoachangan: "changan",
  // Chana was Changan's name abroad.
  chana: "changan",
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const keyOf = (brand: string) => {
  const key = normalize(brand);
  return aliases[key] ?? key;
};

/** URL of a FIPE brand's monochrome icon, or null when there is none. */
export function brandIconUrl(brand: string): string | null {
  const icon = keyOf(brand);
  return available.has(icon) ? `${import.meta.env.BASE_URL}brands/${icon}.svg` : null;
}

/** URL of a FIPE brand's color logo, or null when there is none. */
export function brandLogoUrl(brand: string): string | null {
  const logo = keyOf(brand);
  return withLogo.has(logo) ? `${import.meta.env.BASE_URL}brands/logos/${logo}.png` : null;
}
