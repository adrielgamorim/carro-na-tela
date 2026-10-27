import { lazy, Suspense, useCallback, useState } from "react";
import { Clock3 } from "lucide-react";
import { useCatalogEntries } from "../hooks/useCatalogEntries";
import type { FipeCatalog } from "../hooks/useFipeCatalog";
import type { FipeCodeLookup } from "../hooks/useFipeCodeLookup";
import type { FipeVehicle } from "../types/vehicle";
import { ComparisonPanel } from "./ComparisonPanel";
import { ResultsPanel } from "./ResultsPanel";
import { SearchPanel } from "./SearchPanel";
import "./ConsultaPage.css";

// Opened on demand, so it loads on demand (shared with the catalog's chunk).
const CompareTable = lazy(() =>
  import("./catalog/CompareTable").then((module) => ({ default: module.CompareTable })),
);

interface ConsultaCompareTableProps {
  comparison: FipeVehicle[];
  onRemove: (vehicle: FipeVehicle) => void;
  onClose: () => void;
}

/**
 * The attribute table for vehicles consulted live; INMETRO data comes from the
 * catalog slices of their brands, loaded only when the table opens.
 */
function ConsultaCompareTable({ comparison, onRemove, onClose }: ConsultaCompareTableProps) {
  const entryFor = useCatalogEntries(comparison);
  return (
    <Suspense fallback={null}>
      <CompareTable
        comparison={comparison}
        entryFor={entryFor}
        onRemove={onRemove}
        onClose={onClose}
      />
    </Suspense>
  );
}

interface ConsultaPageProps {
  catalog: FipeCatalog;
  codeLookup: FipeCodeLookup;
  consulted: FipeVehicle[];
  comparison: FipeVehicle[];
  onToggleComparison: (vehicle: FipeVehicle) => void;
  onClearConsulted: () => void;
  onClearComparison: () => void;
}

export function ConsultaPage({
  catalog,
  codeLookup,
  consulted,
  comparison,
  onToggleComparison,
  onClearConsulted,
  onClearComparison,
}: ConsultaPageProps) {
  const { referenceMonth } = catalog;
  const [tableOpen, setTableOpen] = useState(false);
  const closeTable = useCallback(() => setTableOpen(false), []);

  return (
    <>
      <section className="page-heading" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">
            <span>01</span> PESQUISA DE VEÍCULOS
          </p>
          <h1 id="page-title">
            Referência certa.
            <br />
            <em>Escolha consciente.</em>
          </h1>
          <p className="heading-copy">
            Consulte valores FIPE e compare opções lado a lado.
          </p>
        </div>
        <div className="reference-stamp">
          <div className="reference-icon">
            <Clock3 size={17} />
          </div>
          <div>
            <span className="stamp-label">TABELA DE REFERÊNCIA</span>
            <strong>{referenceMonth ?? "Carregando tabela..."}</strong>
          </div>
          <span className="stamp-dot" />
        </div>
      </section>

      <div className="dashboard-layout">
        <div className="main-column">
          <SearchPanel catalog={catalog} codeLookup={codeLookup} />
          <ResultsPanel
            consulted={consulted}
            comparison={comparison}
            onToggleComparison={onToggleComparison}
            onClearConsulted={onClearConsulted}
          />
        </div>
        <ComparisonPanel
          comparison={comparison}
          onRemove={onToggleComparison}
          onClear={onClearComparison}
          onOpenTable={() => setTableOpen(true)}
        />
      </div>
      {tableOpen && (
        <ConsultaCompareTable
          comparison={comparison}
          onRemove={onToggleComparison}
          onClose={closeTable}
        />
      )}
    </>
  );
}
