import { describe, expect, it } from "vitest";
import { clearCatalogParams } from "../catalog/catalogParams";
import { clearConsultaParams, readConsultaParams, writeConsultaParams } from "./consultaUrl";
import type { ConsultaSelection } from "./consultaUrl";

const empty: ConsultaSelection = {
  category: "cars",
  reference: "",
  brand: "",
  modelFamily: "",
  model: "",
  year: "",
  yearFirst: false,
  fipeCode: "",
  fipeYear: "",
};

describe("consulta URL params", () => {
  it("round-trips a cascade selection, leaving defaults out", () => {
    const selection: ConsultaSelection = {
      ...empty,
      category: "trucks",
      reference: "337",
      brand: "21",
      modelFamily: "Grand Siena",
      model: "11",
      year: "2026-5",
      yearFirst: true,
    };
    const params = new URLSearchParams("view=catalogo&marca=Fiat");
    writeConsultaParams(selection, params, "338");

    expect(params.toString()).toBe(
      "view=catalogo&marca=Fiat&tipo=trucks&referencia=337&marcaId=21" +
        "&familia=Grand+Siena&modeloId=11&anoId=2026-5&anoPrimeiro=1",
    );
    expect(readConsultaParams(params)).toEqual(selection);
  });

  it("omits the latest reference and clears removed keys", () => {
    const params = new URLSearchParams("marcaId=21&familia=ARGO&anoId=2026-5");
    writeConsultaParams({ ...empty, reference: "338" }, params, "338");
    expect(params.toString()).toBe("");
  });

  it("round-trips a lookup by FIPE code", () => {
    const params = new URLSearchParams();
    writeConsultaParams({ ...empty, fipeCode: "001580-1", fipeYear: "32000-5" }, params);

    expect(params.toString()).toBe("fipe=001580-1&fipeAno=32000-5");
    expect(readConsultaParams(params)).toMatchObject({
      fipeCode: "001580-1",
      fipeYear: "32000-5",
    });
  });

  it("drops invalid or orphan values", () => {
    expect(
      readConsultaParams(
        new URLSearchParams(
          "tipo=boats&referencia=x&familia=ARGO&modeloId=11&anoId=abc&fipe=123&fipeAno=2026-5",
        ),
      ),
    ).toEqual(empty);
    // A model without its brand and family cannot be restored.
    expect(readConsultaParams(new URLSearchParams("marcaId=21&modeloId=11"))).toMatchObject({
      brand: "21",
      modelFamily: "",
      model: "",
    });
  });
});

describe("one view per URL", () => {
  it("clears only the consultation or only the catalog filters", () => {
    const url = "view=catalogo&marcaId=22&familia=EcoSport&modeloId=6162&anoId=2015-5&fipe=001580-1&q=onix&marca=Fiat&ano=2020-2020";
    const catalog = new URLSearchParams(url);
    clearConsultaParams(catalog);
    expect(catalog.toString()).toBe("view=catalogo&q=onix&marca=Fiat&ano=2020-2020");

    const consulta = new URLSearchParams(url);
    clearCatalogParams(consulta);
    expect(consulta.toString()).toBe(
      "view=catalogo&marcaId=22&familia=EcoSport&modeloId=6162&anoId=2015-5&fipe=001580-1",
    );
  });
});
