// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogEntry, CatalogIndex } from "../../catalog/types";
import { CatalogPage } from "./CatalogPage";

// The catalog the page gets: two lines of two brands, one with two model years.
function entry(overrides: Partial<CatalogEntry>): CatalogEntry {
  return {
    transmission: null,
    gears: null,
    bodyType: null,
    size: null,
    steering: null,
    airConditioning: null,
    cityKmL: null,
    highwayKmL: null,
    inmetro: null,
    wikidata: null,
    fleet: null,
    press: null,
    origin: null,
    depreciation: null,
    id: "x",
    category: "cars",
    brand: "Fiat",
    fipeBrand: "Fiat",
    brandCode: "21",
    family: "Mobi",
    model: "MOBI LIKE 1.0 Fire Flex 5p.",
    modelCode: "8000",
    codeFipe: "001-1",
    yearCode: "2024-1",
    modelYear: 2024,
    zeroKm: false,
    fuel: "Flex",
    propulsion: "combustao",
    price: "R$ 60.000,00",
    priceValue: 60000,
    referenceCode: "338",
    referenceMonth: "outubro de 2026",
    attributes: {},
    ...overrides,
  };
}

const index: CatalogIndex = {
  generatedAt: "2026-10-29T00:00:00.000Z",
  snapshots: [],
  entries: [
    entry({ id: "21-8000:2024-1" }),
    entry({ id: "21-8000:2023-1", yearCode: "2023-1", modelYear: 2023, price: "R$ 55.000,00", priceValue: 55000 }),
    entry({
      id: "59-9000:2024-1",
      brand: "VW - VolksWagen",
      fipeBrand: "VW - VolksWagen",
      brandCode: "59",
      family: "Polo",
      model: "Polo Highline 200 TSI 1.0 Flex 12V Aut.",
      modelCode: "9000",
      codeFipe: "005-5",
      price: "R$ 110.000,00",
      priceValue: 110000,
    }),
  ],
};

vi.mock("../../hooks/useCatalogIndex", () => ({ useCatalogIndex: () => ({ status: "ready", index }) }));
vi.mock("../../hooks/useLivePrices", () => ({ useLivePrices: () => ({ livePrices: {}, fetchPrice: vi.fn() }) }));
vi.mock("../../hooks/useVehicleEnrichment", () => ({
  useVehicleEnrichment: () => ({ enrichmentByVehicle: {}, loadEnrichment: vi.fn(), retryEnrichment: vi.fn() }),
}));

function renderPage() {
  render(
    <CatalogPage mode="catalogo" comparison={[]} onToggleCompare={vi.fn()} onOpenComparison={vi.fn()} onOpenCatalog={vi.fn()} />,
  );
}
const resultsTitle = () => screen.getByRole("heading", { level: 2, name: /vers(ão|ões)/ });

describe("CatalogPage", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));
  afterEach(cleanup);

  it("lists the catalog's versions, a card per version with its model years", () => {
    renderPage();
    expect(resultsTitle().textContent).toMatch(/2\s*versões\s*·\s*3 anos-modelo/);
    expect(screen.getByText("MOBI LIKE 1.0 Fire Flex 5p.")).toBeTruthy();
    expect(screen.getByText("Polo Highline 200 TSI 1.0 Flex 12V Aut.")).toBeTruthy();
  });

  it("filters by the search and keeps it in the URL", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Buscar no catálogo"), { target: { value: "polo" } });
    await waitFor(() => expect(resultsTitle().textContent).toMatch(/1\s*versão/));
    expect(screen.queryByText("MOBI LIKE 1.0 Fire Flex 5p.")).toBeNull();
    expect(new URLSearchParams(window.location.search).get("q")).toBe("polo");
  });

  it("reads its filters from the URL", () => {
    window.history.replaceState(null, "", "/?q=mobi");
    renderPage();
    expect(resultsTitle().textContent).toMatch(/1\s*versão\s*·\s*2 anos-modelo/);
    expect(within(screen.getByLabelText("Filtros ativos")).getByText(/mobi/i)).toBeTruthy();
  });

  it("opens a version's page from its link in the URL", () => {
    window.history.replaceState(null, "", "/?versao=59-9000:2024-1");
    renderPage();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Polo Highline 200 TSI 1.0 Flex 12V Aut.");
  });
});
