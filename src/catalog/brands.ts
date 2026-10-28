// FIPE lists some makers under several names: the importer's and the
// maker's ("Caoa Chery", "Caoa Chery/Chery"), or an old export name ("CHANA"
// for Changan). The catalog shows, filters and groups them as one maker; the
// FIPE name stays on each entry (fipeBrand) for everything that talks to FIPE.

const makers: Record<string, string> = {
  "Caoa Chery": "Chery",
  "Caoa Chery/Chery": "Chery",
  "Caoa Changan": "Changan",
  CHANGAN: "Changan",
  // Chang'an's name in Brazil for the Star vans (Cargo, Family, Utility).
  CHANA: "Changan",
};

/** The maker's name for a FIPE brand: "Caoa Chery/Chery" → "Chery"; most stay as they are. */
export function catalogBrand(fipeBrand: string): string {
  return makers[fipeBrand] ?? fipeBrand;
}
