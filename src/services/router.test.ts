import { describe, expect, it } from "vitest";
import { readView, viewUrl } from "./router";

describe("router", () => {
  it("opens the catalog unless the URL is a consultation, old links included", () => {
    expect(readView("")).toBe("catalogo");
    expect(readView("?marca=Fiat")).toBe("catalogo");
    expect(readView("?view=catalogo&marca=Fiat")).toBe("catalogo");
    expect(readView("?view=consulta")).toBe("consulta");
    // A consultation shared before the catalog became the home.
    expect(readView("?marcaId=21&familia=ARGO")).toBe("consulta");
    expect(readView("?fipe=001580-1")).toBe("consulta");
  });

  it("keeps only the target view's parameters, and the anchor", () => {
    const consulta = "http://x/?marcaId=22&familia=EcoSport&q=onix&marca=Fiat#comparacao";
    expect(viewUrl(consulta, "catalogo").search).toBe("?q=onix&marca=Fiat");
    expect(viewUrl(consulta, "catalogo").hash).toBe("");
    const catalogo = "http://x/?view=catalogo&marca=Fiat&versao=21-1%3A2026-5&marcaId=22";
    expect(viewUrl(catalogo, "consulta", "comparacao").href).toBe("http://x/?view=consulta&marcaId=22#comparacao");
  });
});
