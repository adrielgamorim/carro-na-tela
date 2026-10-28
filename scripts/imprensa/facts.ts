// Reviewed press-release figures (data/imprensa/stellantis.json) and how
// they reach the FIPE versions: a figure holds for its model line from the
// year of the release until the next figure of the same kind, and torque only
// for the versions with that engine.

import type { PressSource } from "../../src/catalog/press.ts";
import type { PressEngine } from "./press.ts";
import { plainWords } from "./press.ts";

export interface PressFact {
  /** Release URL, kind and value: identifies a candidate across runs. */
  key: string;
  /** FIPE brand and family (first word of the FIPE name, as getModelFamily). */
  brand: string;
  family: string;
  /** Words the FIPE name must have ("LOUNGE" in the C4 family), when the figure is for some versions only. */
  words?: string[];
  /** Words the FIPE name must not have ("DIESEL" for a figure of the flex versions). */
  notWords?: string[];
  kind: "trunk" | "torque";
  /** Liters (trunk) or kgfm (torque). */
  value: number;
  /** Engine the torque is for. */
  engine?: PressEngine;
  /** First model year it holds for. */
  from: number;
  /** Last model year, when the release itself says so (a new generation followed). */
  to?: number;
  source: PressSource;
  /** The release's sentence, to review the figure against. */
  quote: string;
}

export interface PressFactsFile {
  _doc?: string;
  facts: PressFact[];
  /** Keys of candidates reviewed and found wrong. */
  rejected: string[];
}

export const candidateKey = (url: string, kind: PressFact["kind"], value: number) =>
  `${url}|${kind}|${value}`;

/** What a FIPE version-year needs to be matched to a figure. */
export interface PressTarget {
  brand: string;
  family: string;
  name: string;
  modelYear: number;
  engineLiters?: number;
  valves?: number;
  turbo: boolean;
  diesel: boolean;
}

/** How long a figure holds with no newer one: about a generation. */
const maxYears = 8;

const fits = (fact: PressFact, target: PressTarget) => {
  if (fact.brand !== target.brand || fact.family !== target.family) return false;
  const name = plainWords(target.name);
  if (fact.words?.some((word) => !name.includes(plainWords(word)))) return false;
  if (fact.notWords?.some((word) => name.includes(plainWords(word)))) return false;
  if (fact.kind === "torque") {
    const engine = fact.engine;
    if (!engine || target.engineLiters === undefined) return false;
    if (Math.abs(engine.liters - target.engineLiters) > 0.05) return false;
    if (engine.turbo !== target.turbo || engine.diesel !== target.diesel) return false;
    if (engine.valves && target.valves && engine.valves !== target.valves) return false;
  }
  return true;
};

/**
 * The trunk and torque figures of a version-year: of the figures that fit it,
 * the latest one from its model year or before (the year after for a release
 * of the previous year: launches come before the model year).
 */
export function pressSpecsOf(facts: PressFact[], target: PressTarget) {
  const pick = (kind: PressFact["kind"]) => {
    const fitting = facts
      .filter((fact) => fact.kind === kind && fits(fact, target))
      .filter((fact) => fact.from <= target.modelYear && (fact.to ?? fact.from + maxYears) >= target.modelYear)
      .sort((a, b) => b.from - a.from || b.source.date.localeCompare(a.source.date));
    // The narrowest figure wins over a line-wide one of the same year.
    const latest = fitting.filter((fact) => fact.from === fitting[0]?.from);
    return latest.sort((a, b) => (b.words?.length ?? 0) - (a.words?.length ?? 0))[0];
  };
  return { trunk: pick("trunk"), torque: pick("torque") };
}
