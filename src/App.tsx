import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowDownUp, GitCompareArrows, Star } from "lucide-react";
import "./App.css";
import { ConsultaPage } from "./components/ConsultaPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeToggle } from "./components/ThemeToggle";
import { useFipeCatalog } from "./hooks/useFipeCatalog";
import { useFipeCodeLookup } from "./hooks/useFipeCodeLookup";
import { useView } from "./hooks/useView";
import {
  clearConsultaParams,
  readConsultaParams,
  writeConsultaParams,
} from "./services/consultaUrl";
import { readView } from "./services/router";
import { useFavorites } from "./services/favorites";
import { loadSession, saveSession } from "./services/storage";
import type { FipeVehicle } from "./types/vehicle";

// The catalog (filters, cards, chassis search, its CSS) is a chunk of its own:
// the Consulta FIPE, the default view, does not need it.
const loadCatalogPage = () => import("./components/catalog/CatalogPage");
const CatalogPage = lazy(() =>
  loadCatalogPage().then((module) => ({ default: module.CatalogPage })),
);

function App() {
  const { view, navigate, viewLink } = useView();
  const favorites = useFavorites();
  const [initialSession] = useState(() => loadSession());
  const [consulted, setConsulted] = useState<FipeVehicle[]>(
    initialSession.consulted,
  );
  const [comparison, setComparison] = useState<FipeVehicle[]>(
    initialSession.comparison,
  );
  // A shared link reopens the same consultation (see services/consultaUrl.ts).
  // Links to the catalog never carry one (older ones might).
  const [sharedConsulta] = useState(() =>
    readConsultaParams(
      new URLSearchParams(readView(window.location.search) === "catalogo" ? "" : window.location.search),
    ),
  );
  const addConsulted = (vehicle: FipeVehicle) => {
    setConsulted((items) => [
      vehicle,
      ...items.filter((item) => item.id !== vehicle.id),
    ]);
  };
  const catalog = useFipeCatalog(addConsulted, sharedConsulta);
  const codeLookup = useFipeCodeLookup(
    catalog.reference,
    addConsulted,
    sharedConsulta.fipeCode
      ? {
          code: sharedConsulta.fipeCode,
          year: sharedConsulta.fipeYear,
          category: sharedConsulta.category,
        }
      : undefined,
  );
  const { referenceMonth } = catalog;
  const latestReference = catalog.references[0]?.code;

  useEffect(() => {
    saveSession({ consulted, comparison });
  }, [comparison, consulted]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (view !== "consulta") {
      clearConsultaParams(url.searchParams);
      window.history.replaceState(window.history.state, "", url);
      return;
    }
    writeConsultaParams(
      {
        category: catalog.category,
        reference: catalog.reference,
        brand: catalog.brand,
        modelFamily: catalog.modelFamily,
        model: catalog.model,
        year: catalog.year,
        yearFirst: catalog.yearSelectionStarted,
        fipeCode: codeLookup.code,
        fipeYear: codeLookup.year,
      },
      url.searchParams,
      // Until the references load, the restored reference must stay in the URL.
      latestReference ?? "",
    );
    window.history.replaceState(window.history.state, "", url);
  }, [
    catalog.category,
    catalog.reference,
    catalog.brand,
    catalog.modelFamily,
    catalog.model,
    catalog.year,
    catalog.yearSelectionStarted,
    codeLookup.code,
    codeLookup.year,
    latestReference,
    view,
  ]);

  function toggleComparison(vehicle: FipeVehicle) {
    setComparison((items) => {
      if (items.some((item) => item.id === vehicle.id))
        return items.filter((item) => item.id !== vehicle.id);
      return items.length < 4 ? [...items, vehicle] : items;
    });
  }

  // Catalog vehicles join the consulted list too, so they keep their price
  // history and survive a reload (stored comparisons must be consulted ones).
  function toggleCatalogComparison(vehicle: FipeVehicle) {
    const compared = comparison.some((item) => item.id === vehicle.id);
    if (!compared && comparison.length >= 4) return;
    if (!compared) {
      setConsulted((items) =>
        items.some((item) => item.id === vehicle.id) ? items : [vehicle, ...items],
      );
    }
    toggleComparison(vehicle);
  }

  function clearConsulted() {
    setConsulted([]);
    setComparison([]);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Carro na tela, início">
          <span className="brand-mark">
            <ArrowDownUp size={17} />
          </span>
          <span className="brand-name">
            Carro <span>na tela</span>
          </span>
        </a>
        <nav className="top-navigation" aria-label="Navegação principal">
          <a
            className={`nav-link${view === "catalogo" ? " nav-link-active" : ""}`}
            aria-current={view === "catalogo" ? "page" : undefined}
            {...viewLink("catalogo")}
            // Start fetching the chunk before the click lands.
            onPointerEnter={() => void loadCatalogPage()}
            onFocus={() => void loadCatalogPage()}
          >
            Catálogo
          </a>
          <a
            className={`nav-link${view === "consulta" ? " nav-link-active" : ""}`}
            aria-current={view === "consulta" ? "page" : undefined}
            {...viewLink("consulta")}
          >
            Consulta<span className="nav-label-extra"> FIPE</span>
          </a>
          <a
            className={`nav-link nav-link-favorites${view === "favoritos" ? " nav-link-active" : ""}`}
            aria-current={view === "favoritos" ? "page" : undefined}
            {...viewLink("favoritos")}
            onPointerEnter={() => void loadCatalogPage()}
            onFocus={() => void loadCatalogPage()}
          >
            <Star size={14} aria-hidden="true" />
            <span className="nav-label-extra">Favoritos </span>
            <span className="nav-count">{favorites.length}</span>
          </a>
          <a
            className="nav-link nav-link-comparison"
            {...viewLink("consulta", "comparacao")}
          >
            <GitCompareArrows size={14} aria-hidden="true" />
            <span className="nav-label-extra">Comparador </span>
            <span className="nav-count">{comparison.length}</span>
          </a>
        </nav>
        <div className="topbar-reference">
          <span className="live-dot" /> Base FIPE{" "}
          <span className="topbar-divider" /> {referenceMonth ?? "Atualizando"}
        </div>
        <ThemeToggle />
      </header>

      <main id="inicio" className="workspace">
        {view !== "consulta" ? (
          // The favorites are the catalog's cards: one page, so a version opened
          // from either keeps the list behind it.
          <ErrorBoundary key="catalogo" label="o catálogo">
            <Suspense
              fallback={
                <p className="page-loading">
                  <span className="spinner" /> Carregando catálogo...
                </p>
              }
            >
              <CatalogPage
                mode={view}
                comparison={comparison}
                onToggleCompare={toggleCatalogComparison}
                onOpenComparison={() => navigate("consulta", "comparacao")}
                onOpenCatalog={() => navigate("catalogo")}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary key="consulta" label="a consulta">
            <ConsultaPage
              catalog={catalog}
              codeLookup={codeLookup}
              consulted={consulted}
              comparison={comparison}
              onToggleComparison={toggleComparison}
              onClearConsulted={clearConsulted}
              onClearComparison={() => setComparison([])}
            />
          </ErrorBoundary>
        )}
        <footer className="page-footer">
          <span>
            CARRO NA TELA <span className="footer-separator">/</span> CONSULTA
            DE REFERÊNCIA
          </span>
          <span>Os valores FIPE não substituem avaliação do veículo.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
