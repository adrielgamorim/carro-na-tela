import { describe, expect, it } from "vitest";
import { parseSpecRows, specsQuery } from "./specs.ts";

const row = (id: string, property: string, amount: string) => ({
  m: { value: `http://www.wikidata.org/entity/${id}` },
  property: { value: property },
  amount: { value: amount },
});

describe("Wikidata specs", () => {
  it("asks for the normalized size and mass of the items", () => {
    const query = specsQuery(["Q1", "Q2"]);
    expect(query).toContain("VALUES ?m { wd:Q1 wd:Q2 }");
    expect(query).toContain("(p:P2043 psv:P2043 \"P2043\")");
    expect(query).toContain("wikibase:quantityNormalized");
  });

  it("keeps plausible values, as a range when there are several", () => {
    expect(
      parseSpecRows([
        row("Q1", "P2043", "3.998"),
        row("Q1", "P2043", "4.1004"),
        row("Q1", "P2067", "1150.4"),
        // 40 m long and 12 kg are errors in the data.
        row("Q1", "P2049", "40"),
        row("Q2", "P2067", "12"),
        row("Q2", "P9999", "3"),
      ]),
    ).toEqual({ Q1: { length: [3.998, 4.1], mass: [1150, 1150] } });
  });
});
