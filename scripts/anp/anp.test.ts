import { describe, expect, it } from "vitest";
import { formatAnpWeek } from "../../src/catalog/fuelPrices.ts";
import { parseAnpCsv, summarizeFuelPrices, surveyWeek } from "./anp.ts";

const header =
  "Regiao - Sigla;Estado - Sigla;Municipio;Revenda;CNPJ da Revenda;Nome da Rua;Numero Rua;" +
  "Complemento;Bairro;Cep;Produto;Data da Coleta;Valor de Venda;Valor de Compra;Unidade de Medida;Bandeira";

function line(uf: string, product: string, date: string, price: string, street = "RUA A") {
  return `SE;${uf};CIDADE;POSTO;00.000.000/0001-00;${street};10;;CENTRO;01000-000;${product};${date};${price};;R$ / litro;BRANCA`;
}

describe("surveyWeek", () => {
  it("returns the Sunday that starts the week", () => {
    expect(surveyWeek("24/10/2026")).toBe("2026-10-18");
    expect(surveyWeek("18/10/2026")).toBe("2026-10-18");
    expect(surveyWeek("2026-10-18")).toBeNull();
  });
});

describe("parseAnpCsv", () => {
  it("reads regular gasoline, ethanol and S10 diesel, even with ';' in the address", () => {
    const csv = [
      header,
      line("SP", "GASOLINA", "20/10/2026", "6,39"),
      line("SP", "GASOLINA ADITIVADA", "20/10/2026", "6,59"),
      line("SP", "ETANOL", "21/10/2026", "3,99", "RODOVIA; KM 10"),
      line("SP", "DIESEL S10", "22/10/2026", "7,29"),
      line("SP", "DIESEL", "22/10/2026", "7,09"),
      line("XX", "GASOLINA", "22/10/2026", "6,00"),
      line("SP", "GASOLINA", "22/10/2026", ""),
      "",
    ].join("\r\n");

    expect(parseAnpCsv(csv)).toEqual([
      { uf: "SP", fuel: "gasolina", week: "2026-10-18", price: 6.39 },
      { uf: "SP", fuel: "etanol", week: "2026-10-18", price: 3.99 },
      { uf: "SP", fuel: "diesel", week: "2026-10-18", price: 7.29 },
    ]);
  });
});

describe("summarizeFuelPrices", () => {
  it("averages the newest week per state and fuel, falling back to older weeks", () => {
    const summary = summarizeFuelPrices(
      [
        { uf: "SP", fuel: "gasolina", week: "2026-10-18", price: 6.3 },
        { uf: "SP", fuel: "gasolina", week: "2026-10-18", price: 6.5 },
        { uf: "SP", fuel: "gasolina", week: "2026-10-11", price: 9 },
        { uf: "AP", fuel: "gasolina", week: "2026-10-18", price: 6.39 },
        // No ethanol in Amapá this week: the previous one is used.
        { uf: "AP", fuel: "etanol", week: "2026-10-11", price: 5.81 },
      ],
      new Date("2026-10-26T12:00:00Z"),
    );

    expect(summary).toEqual({
      version: 1,
      generatedAt: "2026-10-26T12:00:00.000Z",
      week: { from: "2026-10-18", to: "2026-10-24" },
      national: { gasolina: 6.4, etanol: 5.81 },
      states: {
        AP: { gasolina: 6.39, etanol: 5.81 },
        SP: { gasolina: 6.4 },
      },
    });
    expect(formatAnpWeek(summary.week)).toBe("18 a 24/10/2026");
    expect(formatAnpWeek({ from: "2026-09-27", to: "2026-10-03" })).toBe("27/09 a 03/10/2026");
  });

  it("fails without data", () => {
    expect(() => summarizeFuelPrices([])).toThrow();
  });
});
