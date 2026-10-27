// Brand logos from Simple Icons (CC0), served as public/brands/<key>.svg by
// npm run build:brand-icons. Several car makers asked Simple Icons to remove
// theirs (Mercedes-Benz, BYD, Land Rover, Jaguar…); those keep the generic
// vehicle icon.

import { brandIconKeys } from "./brandIconKeys.ts";

const available = new Set(brandIconKeys);

// FIPE names that are not the brand's plain name.
const aliases: Record<string, string> = {
  gmchevrolet: "chevrolet",
  vwvolkswagen: "volkswagen",
  kiamotors: "kia",
  yamahamotor: "yamaha",
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** URL of a FIPE brand's logo, or null when there is none. */
export function brandIconUrl(brand: string): string | null {
  const key = normalize(brand);
  const icon = aliases[key] ?? key;
  return available.has(icon) ? `${import.meta.env.BASE_URL}brands/${icon}.svg` : null;
}
