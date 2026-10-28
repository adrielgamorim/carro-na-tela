import { describe, expect, it } from "vitest";
import { pressSpecsOf } from "./facts.ts";
import type { PressFact, PressTarget } from "./facts.ts";

const source = { url: "https://x", title: "Release", date: "2021-10-19" };
const fact = (fields: Partial<PressFact>): PressFact => ({
  key: "k",
  brand: "Fiat",
  family: "PULSE",
  kind: "trunk",
  value: 370,
  from: 2021,
  source,
  quote: "",
  ...fields,
});
const pulse: PressTarget = {
  brand: "Fiat",
  family: "PULSE",
  name: "PULSE DRIVE 1.3 8V Flex Aut.",
  modelYear: 2023,
  engineLiters: 1.3,
  valves: 8,
  turbo: false,
  diesel: false,
};

describe("pressSpecsOf", () => {
  it("holds a figure from its year until a newer one, for about a generation", () => {
    const facts = [fact({ value: 300, from: 2017 }), fact({ value: 370, from: 2021 })];
    expect(pressSpecsOf(facts, pulse).trunk?.value).toBe(370);
    expect(pressSpecsOf(facts, { ...pulse, modelYear: 2019 }).trunk?.value).toBe(300);
    expect(pressSpecsOf(facts, { ...pulse, modelYear: 2016 }).trunk).toBeUndefined();
    expect(pressSpecsOf(facts, { ...pulse, modelYear: 2030 }).trunk).toBeUndefined();
  });

  it("keeps a figure to the versions it names", () => {
    const facts = [
      fact({ family: "C10", brand: "Leapmotor", value: 465, notWords: ["HIBRIDO"] }),
      fact({ family: "C10", brand: "Leapmotor", value: 435, words: ["HIBRIDO"] }),
    ];
    const c10 = { ...pulse, brand: "Leapmotor", family: "C10", modelYear: 2026 };
    expect(pressSpecsOf(facts, { ...c10, name: "C10 (Elétrico)" }).trunk?.value).toBe(465);
    expect(pressSpecsOf(facts, { ...c10, name: "C10 (Híbrido)" }).trunk?.value).toBe(435);
  });

  it("gives torque only to the engine it was stated for", () => {
    const torque = (value: number, engine: PressFact["engine"]) => fact({ kind: "torque", value, engine });
    const facts = [
      torque(14.2, { liters: 1.3, turbo: false, diesel: false }),
      torque(20.4, { liters: 1, turbo: true, diesel: false }),
      torque(18.9, { liters: 1.8, turbo: false, diesel: false, valves: 16 }),
    ];
    expect(pressSpecsOf(facts, pulse).torque?.value).toBe(14.2);
    expect(pressSpecsOf(facts, { ...pulse, engineLiters: 1, turbo: true }).torque?.value).toBe(20.4);
    expect(pressSpecsOf(facts, { ...pulse, engineLiters: 1.8, valves: 8 }).torque).toBeUndefined();
    expect(pressSpecsOf(facts, { ...pulse, engineLiters: 1.8, valves: undefined }).torque?.value).toBe(18.9);
    expect(pressSpecsOf(facts, { ...pulse, engineLiters: undefined }).torque).toBeUndefined();
  });
});
