// Labels and value helpers shared by the catalog filter controls.

export type Labeler = (value: string) => string;

export const asIs: Labeler = (value) => value;
export const fromRecord =
  (labels: Record<string, string>): Labeler =>
  (value) =>
    labels[value] ?? value;

export function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
