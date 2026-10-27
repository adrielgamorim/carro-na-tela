import { describe, expect, it } from "vitest";
import { parseModelName } from "./modelName";

// Every name below is a real FIPE model name (Parallelum API, out/2026).
describe("parseModelName", () => {
  it.each([
    [
      "ARGO DRIVE 1.3 8V Flex",
      { engineLiters: 1.3, valves: 8, fuel: "flex" },
    ],
    [
      "Renegade Trailhawk 2.0 4x4 TB Diesel Aut",
      {
        engineLiters: 2,
        aspiration: "turbo",
        transmission: "automatico",
        fourWheelDrive: true,
        fuel: "diesel",
      },
    ],
    [
      "Wrangler Unlimited Sport 3.6 V6 284cv 4p",
      { engineLiters: 3.6, cylinders: 6, powerCv: 284, doors: 4 },
    ],
    [
      "Civic Coupe Si 1.5 TB 16V 208cv Mec. 2p",
      {
        engineLiters: 1.5,
        valves: 16,
        aspiration: "turbo",
        powerCv: 208,
        transmission: "manual",
        doors: 2,
        bodyHint: "cupe",
      },
    ],
    [
      "Strada Trekking 1.6 16V Flex CS",
      {
        engineLiters: 1.6,
        valves: 16,
        fuel: "flex",
        bodyHint: "picape",
        cab: "simples",
      },
    ],
    [
      "RAMPAGE REBEL 2.0 TB CD 4X4 Diesel Aut.",
      {
        engineLiters: 2,
        aspiration: "turbo",
        transmission: "automatico",
        fourWheelDrive: true,
        fuel: "diesel",
        bodyHint: "picape",
        cab: "dupla",
      },
    ],
    [
      "MOBI WAY 1.0 Fire Flex 5p.",
      { engineLiters: 1, fuel: "flex", doors: 5 },
    ],
    [
      "Civic Sedan LX 2.0 Flex 16V Aut. 4p",
      {
        engineLiters: 2,
        valves: 16,
        transmission: "automatico",
        doors: 4,
        fuel: "flex",
        bodyHint: "sedan",
      },
    ],
    [
      "Palio Weekend Stile 1.6 mpi 16V 4p",
      { engineLiters: 1.6, valves: 16, doors: 4, bodyHint: "perua" },
    ],
    [
      "S-63 Cabriolet AMG 5.5 V8 Bi-Turbo Aut.",
      {
        engineLiters: 5.5,
        cylinders: 8,
        aspiration: "turbo",
        transmission: "automatico",
        bodyHint: "conversivel",
      },
    ],
  ])("%s", (name, expected) => {
    expect(parseModelName(name)).toEqual(expected);
  });

  it("detects electric and hybrid propulsion", () => {
    expect(parseModelName("Dolphin Mini GS (Elétrico)").propulsion).toBe(
      "eletrico",
    );
    expect(parseModelName("Corolla Altis 1.8 16V Aut. (Híbrido)")).toMatchObject(
      { propulsion: "hibrido", transmission: "automatico" },
    );
    expect(
      parseModelName("Maverick Lariat Hybrid 2.5 AWD Aut.").propulsion,
    ).toBe("hibrido");
    expect(parseModelName("EQC 400 4MATIC 408CV (Elétrico)")).toMatchObject({
      propulsion: "eletrico",
      fourWheelDrive: true,
      powerCv: 408,
    });
  });

  it("distinguishes transmission types, including glued tokens", () => {
    expect(parseModelName("Ka+ Sedan 1.0 SEL TiCVT Flex 4p").transmission).toBe(
      "cvt",
    );
    expect(
      parseModelName("Santa Fe GLS 2.7 V6 4x4TipTronic"),
    ).toMatchObject({ transmission: "automatico", fourWheelDrive: true });
    expect(
      parseModelName("500 Cult 1.4 Flex 8V EVO Dualogic").transmission,
    ).toBe("automatizado");
    expect(parseModelName("CRONOS DRIVE GSR 1.3 8V Flex").transmission).toBe(
      "automatizado",
    );
    expect(parseModelName("Uno Mille 1.0 Fire").transmission).toBeUndefined();
  });

  it("does not read 'T.B.' (teto baixo) as turbo", () => {
    expect(
      parseModelName("Sprinter 416 Furgão Longo T.B. 2.2 Dies."),
    ).toEqual({ engineLiters: 2.2, fuel: "diesel", bodyHint: "furgao" });
  });

  it("detects superchargers and van/chassis bodies", () => {
    expect(
      parseModelName("C-200 Kompressor Avant.1.8 16V Aut"),
    ).toMatchObject({ aspiration: "compressor", transmission: "automatico" });
    expect(parseModelName("C-200 Kompressor Avant.1.8 16V Aut").bodyHint).toBe(
      undefined,
    );
    expect(
      parseModelName("Sprinter 413-D Chassi Curto/Longo Diesel").bodyHint,
    ).toBe("chassi-cabine");
    expect(
      parseModelName("Sprinter 416 VAN L. T.A. 10L 2.2 Diesel").bodyHint,
    ).toBe("van");
  });

  it("does not read CD/CS trim names as pickup cabs", () => {
    expect(
      parseModelName("Uno CS/Top/Sport 1.5 i.e. / 1.5 4p").bodyHint,
    ).toBeUndefined();
    expect(
      parseModelName("Astra 2.0 8V/ CD 2.0 8V Hatchback 5p Aut").bodyHint,
    ).toBe("hatch");
    expect(parseModelName("Omega CD 3.8 V6").bodyHint).toBeUndefined();
    expect(parseModelName("D-10 CD Diesel").bodyHint).toBe("picape");
    expect(parseModelName("A-20 Custom Std. CD/ De Luxe CD")).toMatchObject({
      bodyHint: "picape",
      cab: "dupla",
    });
  });

  it("reads abbreviated turbo without confusing roof heights or Total Flex", () => {
    expect(parseModelName("Fastback Audace 1.0 200 T. Flex Aut").aspiration).toBe("turbo");
    expect(parseModelName("Fastback Tributo 125 1.0 Turb. Flex Aut").aspiration).toBe("turbo");
    expect(parseModelName("Sprinter 416 Furgão L. T.A. 2.2 Dies.").aspiration).toBeUndefined();
    expect(parseModelName("VOYAGE Comfortline 1.6 T.Flex 8V").aspiration).toBeUndefined();
  });

  it("reads an engine size glued to an abbreviation", () => {
    expect(parseModelName("VOYAGE I MOTION COMF/Hghli.1.6 T.Flex 8V").engineLiters).toBe(1.6);
    expect(parseModelName("Versão 1.0.1").engineLiters).toBeUndefined();
  });

  it("handles accented tokens", () => {
    expect(parseModelName("Peugeot 406 Coupé 3.0").bodyHint).toBe("cupe");
    expect(parseModelName("Logan Sedã 1.6").bodyHint).toBe("sedan");
  });

  it("leaves ambiguous drive configuration unset", () => {
    expect(
      parseModelName("ix35 2.0 16V 170cv 2WD/4WD Aut.").fourWheelDrive,
    ).toBeUndefined();
    expect(parseModelName("S10 LT 2.8 TB 4x2 CD Diesel").fourWheelDrive).toBe(
      false,
    );
  });
});
