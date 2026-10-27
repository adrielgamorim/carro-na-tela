import { lazy, Suspense, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { ArrowDownUp } from "lucide-react";
import "./App.css";
import { ConsultaPage } from "./components/ConsultaPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useFipeCatalog } from "./hooks/useFipeCatalog";
import { useFipeCodeLookup } from "./hooks/useFipeCodeLookup";
import { clearCatalogParams } from "./catalog/catalogParams";
import {
  clearConsultaParams,
  readConsultaParams,
  writeConsultaParams,
} from "./services/consultaUrl";
import { loadSession, saveSession } from "./services/storage";
import type { FipeVehicle } from "./types/vehicle";

type View = "consulta" | "catalogo";

// The catalog (filters, cards, chassis search, its CSS) is a chunk of its own:
// the Consulta FIPE, the default view, does not need it.
const loadCatalogPage = () => import("./components/catalog/CatalogPage");
const CatalogPage = lazy(() =>
  loadCatalogPage().then((module) => ({ default: module.CatalogPage })),
);

function readView(): View {
  return new URLSearchParams(window.location.search).get("view") === "catalogo"
    ? "catalogo"
    : "consulta";
}

/**
 * The URL of a view. Each view keeps only its own parameters in the URL, so
 * a consultation does not linger behind the catalog (and come back on reload)
 * nor catalog filters behind the consultation.
 */
function viewUrl(nextView: View, anchor?: string): URL {
  const url = new URL(window.location.href);
  if (nextView === "catalogo") {
    url.searchParams.set("view", "catalogo");
    clearConsultaParams(url.searchParams);
  } else {
    url.searchParams.delete("view");
    clearCatalogParams(url.searchParams);
  }
  url.hash = anchor ?? "";
  return url;
}

function App() {
  const [view, setView] = useState<View>(readView);
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
      new URLSearchParams(readView() === "catalogo" ? "" : window.location.search),
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
    if (view === "catalogo") {
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

  useEffect(() => {
    const handlePopState = () => setView(readView());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextView: View, anchor?: string) {
    const url = viewUrl(nextView, anchor);
    if (nextView !== view || anchor) window.history.pushState(null, "", url);
    setView(nextView);
    window.setTimeout(() => {
      if (anchor) document.getElementById(anchor)?.scrollIntoView();
      else window.scrollTo({ top: 0 });
    });
  }

  function viewLink(nextView: View, anchor?: string) {
    const url = viewUrl(nextView, anchor);
    return {
      href: `${url.pathname}${url.search}${url.hash}`,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
          return;
        }
        event.preventDefault();
        navigate(nextView, anchor);
      },
    };
  }

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
            className="nav-link nav-link-comparison"
            {...viewLink("consulta", "comparacao")}
          >
            Comparador <span>{comparison.length}</span>
          </a>
        </nav>
        <div className="topbar-reference">
          <span className="live-dot" /> Base FIPE{" "}
          <span className="topbar-divider" /> {referenceMonth ?? "Atualizando"}
        </div>
      </header>

      <main id="inicio" className="workspace">
        {view === "catalogo" ? (
          <ErrorBoundary key="catalogo" label="o catálogo">
            <Suspense
              fallback={
                <p className="page-loading">
                  <span className="spinner" /> Carregando catálogo...
                </p>
              }
            >
              <CatalogPage
                comparison={comparison}
                onToggleCompare={toggleCatalogComparison}
                onOpenComparison={() => navigate("consulta", "comparacao")}
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
