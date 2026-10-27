import { describe, expect, it } from "vitest";
import { infoboxFields, mergeSpecs, parseInfobox, quantities } from "./infobox.ts";

// Trimmed from the real infoboxes of pt:Fiat Argo, en:Fiat Argo and pt:Chevrolet Onix.
const ptArgo = `{{Info/Automóvel
|nome                      = Fiat Argo
|motor                     = 1.0 6v ''Firefly'' (72/77 cv)<br/>1.3 8v ''Firefly'' (101/109 cv)<br/>1.8 ''E.torQ Evo'' 16v(135/139 cv)
|distância entre os eixos  = {{converter|2521|mm|in|3|o=l}}
|comprimento               = {{converter|4000|mm|in|3|o=l}}
|largura                   = {{converter|1750|mm|in|3|o=l}}
|altura                    = {{converter|1500|mm|in|3|o=l}}
|peso                      = {{converter|1243|kg|lb|3|o=l}}
}}
O '''Fiat Argo''' é um hatch…`;

const enArgo = `{{Infobox automobile
| name = Fiat Argo
| engine = {{ubl
 | 1.0 L ''Firefly'' I3
 | 1.3 L ''Firefly'' I4
}}
| length = {{cvt|4000|mm|in|1}}
| width = {{cvt|1750|mm|in|1}}
| height = {{cvt|1505|mm|in|1}}
| wheelbase = {{cvt|2521|mm|in|1}}
| weight = {{cvt|1105|-|1279|kg|lb|0}}
}}`;

const ptOnix = `{{Info/Automóvel
| motor                = 1.0 SPE/4 aspirado Flex<br>1.4 aspirado flex
| potência             = 82 a 116 cv
| comprimento          = {{converter|4163|mm|in|3|o=l}}
| entre eixos          = {{converter|2551|mm|in|3|o=l}}
| altura               = {{converter|1473|mm|in|3|o=l}}
| altura do chão       = 160 mm
| peso                 =
}}`;

describe("infoboxFields", () => {
  it("splits the first car infobox at its top level, multi-line fields included", () => {
    const fields = infoboxFields(enArgo);
    expect(fields.get("engine")).toContain("1.3 L");
    expect(fields.get("weight")).toBe("{{cvt|1105|-|1279|kg|lb|0}}");
    expect(infoboxFields("No infobox here").size).toBe(0);
  });
});

describe("quantities", () => {
  it("reads templates and plain text, in pt and en number styles", () => {
    expect(quantities("{{converter|2521|mm|in|3|o=l}}", "length")).toEqual([2.521]);
    expect(quantities("{{cvt|1105|-|1279|kg|lb|0}}", "mass")).toEqual([1105, 1279]);
    expect(quantities("3.998 mm", "length")).toEqual([3.998]);
    expect(quantities("3,998 mm", "length")).toEqual([3.998]);
    expect(quantities("4,07 m", "length")).toEqual([4.07]);
    expect(quantities("82 a 116 cv", "power")).toEqual([82, 116]);
    expect(quantities("1.0 (72/77 cv)<br/>1.3 (101/109 cv)", "power")).toEqual([72, 77, 101, 109]);
    expect(quantities("{{convert|74|kW|PS hp}}", "power")[0]).toBeCloseTo(100.6, 1);
  });
});

describe("parseInfobox", () => {
  it("reads size, mass and power, ignoring look-alike fields", () => {
    expect(parseInfobox(ptArgo)).toEqual({
      power: [72, 139],
      wheelbase: [2.521, 2.521],
      length: [4, 4],
      width: [1.75, 1.75],
      height: [1.5, 1.5],
      mass: [1243, 1243],
    });
    // "altura do chão" (ground clearance) is not the height; an empty weight is skipped.
    expect(parseInfobox(ptOnix)).toEqual({
      power: [82, 116],
      length: [4.163, 4.163],
      wheelbase: [2.551, 2.551],
      height: [1.473, 1.473],
    });
    expect(parseInfobox(enArgo).mass).toEqual([1105, 1279]);
  });

  it("merges key by key, first source first", () => {
    expect(mergeSpecs({ length: [3.998, 3.998] }, parseInfobox(ptArgo), parseInfobox(enArgo))).toMatchObject({
      length: [3.998, 3.998],
      mass: [1243, 1243],
      height: [1.5, 1.5],
    });
  });

  it("drops length and wheelbase of a source when they cannot both be right", () => {
    // pt:Aston Martin DB9 has the two fields swapped.
    expect(mergeSpecs({ length: [2.741, 2.746], wheelbase: [4.696, 4.712], mass: [1800, 1800] })).toEqual({
      mass: [1800, 1800],
    });
  });
});

describe("power field order", () => {
  it("prefers the power field over the engine list, whichever comes first", () => {
    const text = "{{Info/Automóvel\n| motor = 1.0 (72 cv)<br>1.8 (139 cv)\n| potência = 75 a 135 cv\n}}";
    expect(parseInfobox(text).power).toEqual([75, 135]);
  });
});
