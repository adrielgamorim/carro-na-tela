// Sales estimated from the Senatran fleet: the vehicles of a line made in the
// reference year are (nearly) the ones registered new that year, and the
// month's new registrations are how much the two most recent years of
// manufacture grew since the month before.

import type { CatalogFleetLine } from "../../src/catalog/fleet.ts";

type Years = Record<string, number>;

const recent = (years: Years, year: number) => (years[String(year)] ?? 0) + (years[String(year - 1)] ?? 0);

/**
 * Fills `sales` in each line, ranked among the lines of the same `category`
 * (cars, motorcycles, trucks) that sold any. `previous` holds the same lines'
 * years a month before (undefined: line not matched then).
 */
export function addFleetSales(
  lines: CatalogFleetLine[],
  previous: (Years | undefined)[] | null,
  year: number,
  category: (index: number) => string = () => "",
): void {
  const figures = lines.map((line, index) => {
    const ofYear = line.years[String(year)] ?? 0;
    const before = previous?.[index];
    // Lines that were not in the month before have no difference to show.
    const month = previous && before ? Math.max(0, recent(line.years, year) - recent(before, year)) : null;
    return { ofYear, month };
  });
  const rank = (values: (number | null)[]) => {
    const ranks = new Map<number, number>();
    const positions = new Map<string, number>();
    values
      .map((value, index) => ({ value: value ?? 0, index }))
      .filter(({ value }) => value > 0)
      .sort((a, b) => b.value - a.value)
      .forEach(({ index }) => {
        const group = category(index);
        const position = (positions.get(group) ?? 0) + 1;
        positions.set(group, position);
        ranks.set(index, position);
      });
    return ranks;
  };
  const yearRanks = rank(figures.map(({ ofYear }) => ofYear));
  const monthRanks = rank(figures.map(({ month }) => month));
  lines.forEach((line, index) => {
    const yearRank = yearRanks.get(index);
    const monthRank = monthRanks.get(index);
    if (yearRank === undefined && monthRank === undefined) return;
    const { ofYear, month } = figures[index]!;
    line.sales = {
      year: ofYear,
      ...(yearRank !== undefined && { yearRank }),
      ...(month !== null && { month }),
      ...(monthRank !== undefined && { monthRank }),
    };
  });
}
