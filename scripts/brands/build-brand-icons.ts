// Writes the brand logos the app shows (public/brands/<key>.svg) from Simple
// Icons (CC0). Run after changing the list; the files are committed.
//
//   npm run build:brand-icons
//
// The app loads each logo as a CSS mask only when a card of that brand shows
// up, so the logos (130 KB together, the Porsche alone 24 KB) stay out of the
// JavaScript bundle. The keys are in src/components/brandIconKeys.ts.

import { mkdir, rm } from "node:fs/promises";
import { writeFileRetrying } from "../write-file.ts";
import * as icons from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import { brandIconKeys } from "../../src/components/brandIconKeys.ts";

const exportOf: Record<string, string> = {
  acura: "siAcura",
  astonmartin: "siAstonmartin",
  audi: "siAudi",
  bmw: "siBmw",
  cadillac: "siCadillac",
  chevrolet: "siChevrolet",
  chrysler: "siChrysler",
  citroen: "siCitroen",
  daf: "siDaf",
  ducati: "siDucati",
  ferrari: "siFerrari",
  fiat: "siFiat",
  ford: "siFord",
  honda: "siHonda",
  hyundai: "siHyundai",
  iveco: "siIveco",
  jeep: "siJeep",
  kia: "siKia",
  ktm: "siKtm",
  lada: "siLada",
  lamborghini: "siLamborghini",
  mahindra: "siMahindra",
  maserati: "siMaserati",
  mazda: "siMazda",
  mclaren: "siMclaren",
  mg: "siMg",
  mini: "siMini",
  mitsubishi: "siMitsubishi",
  nissan: "siNissan",
  peugeot: "siPeugeot",
  porsche: "siPorsche",
  ram: "siRam",
  renault: "siRenault",
  rollsroyce: "siRollsroyce",
  saturn: "siSaturn",
  scania: "siScania",
  seat: "siSeat",
  smart: "siSmart",
  subaru: "siSubaru",
  suzuki: "siSuzuki",
  toyota: "siToyota",
  volkswagen: "siVolkswagen",
  volvo: "siVolvo",
  yamaha: "siYamahamotorcorporation",
};

const dir = "public/brands";
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
for (const key of brandIconKeys) {
  const icon = (icons as unknown as Record<string, SimpleIcon>)[exportOf[key] ?? ""];
  if (!icon) throw new Error(`Simple Icons não tem ${exportOf[key]} (${key})`);
  await writeFileRetrying(
    `${dir}/${key}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>${icon.title}</title><path d="${icon.path}"/></svg>
`,
  );
}
console.log(`${brandIconKeys.length} logos em ${dir}`);
