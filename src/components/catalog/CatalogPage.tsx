import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { activeChips } from "../../catalog/activeChips";
import {
  catalogBounds,
  computeFacets,
  countActiveFilters,
  emptyCatalogFilters,
  filterCatalog,
  groupCatalog,
  readCatalogParams,
  writeCatalogParams,
} from "../../catalog/filters";
import type { CatalogFilters, CatalogSort } from "../../catalog/filters";
import { catalogEntryToVehicle } from "../../catalog/labels";
import type { CatalogEntry, CatalogIndex } from "../../catalog/types";
import { vinCatalogFilters } from "../../catalog/vinFilters";
import type { VinFilterResult } from "../../catalog/vinFilters";
import { useCatalogIndex } from "../../hooks/useCatalogIndex";
import { useLivePrices } from "../../hooks/useLivePrices";
import { useVehicleEnrichment } from "../../hooks/useVehicleEnrichment";
import { useVinSearch } from "../../hooks/useVinSearch";
import type { FipeVehicle } from "../../types/vehicle";
import { CatalogCard } from "./CatalogCard";
import { CatalogHeading } from "./CatalogHeading";
import { CatalogFilterPanel } from "./CatalogFilterPanel";
import { CompareTray } from "./CompareTray";
import { VehicleDetailsDialog } from "./VehicleDetailsDialog";
import { VinSearch } from "./VinSearch";
import "./catalog.css";
import "./CatalogPage.css";

const pageSize = 24;

// Opened on demand; shared with the Consulta FIPE.
const CompareTable = lazy(() =>
  import("./CompareTable").then((module) => ({ default: module.CompareTable })),
);

const detailsParam = "versao";

const sortLabels: Record<CatalogSort, string> = {
  "price-asc": "Menor preço",
  "price-desc": "Maior preço",
  newest: "Mais novos",
  consumption: "Mais econômicos",
  popular: "Mais comuns na frota",
  name: "Modelo (A–Z)",
};

interface CatalogPageProps {
  comparison: FipeVehicle[];
  onToggleCompare: (vehicle: FipeVehicle) => void;
  onOpenComparison: () => void;
}

function CatalogBrowser({
  index,
  comparison,
  onToggleCompare,
  onOpenComparison,
}: CatalogPageProps & { index: CatalogIndex }) {
  const [filters, setFilters] = useState<CatalogFilters>(() =>
    readCatalogParams(new URLSearchParams(window.location.search)),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState({ key: "", count: pageSize });
  const [compareOpen, setCompareOpen] = useState(false);
  // A shared link with ?versao= opens that version (when it has a crawled price).
  const [detailsVehicle, setDetailsVehicle] = useState<FipeVehicle | null>(() => {
    const entryId = new URLSearchParams(window.location.search).get(detailsParam);
    const entry = entryId ? index.entries.find((item) => item.id === entryId) : undefined;
    return entry ? catalogEntryToVehicle(entry) : null;
  });
  // The open version is in the URL (?versao=<entry id>), so a link opens it.
  const setDetailsParam = (entryId: string | null) => {
    const url = new URL(window.location.href);
    if (entryId) url.searchParams.set(detailsParam, entryId);
    else url.searchParams.delete(detailsParam);
    window.history.replaceState(window.history.state, "", url);
  };
  const closeDetails = useCallback(() => {
    setDetailsVehicle(null);
    setDetailsParam(null);
  }, []);
  const { enrichmentByVehicle, loadEnrichment, retryEnrichment } = useVehicleEnrichment();
  const closeCompare = useCallback(() => setCompareOpen(false), []);
  const deferredFilters = useDeferredValue(filters);
  const { entries } = index;
  const { livePrices, fetchPrice } = useLivePrices();
  const [vinApplied, setVinApplied] = useState<VinFilterResult | null>(null);
  const vinSearch = useVinSearch((result) => {
    const vehicle = result.vpic === "error" ? null : result.vpic;
    const applied = vinCatalogFilters(
      entries,
      { brands: result.info.brands, modelYear: result.modelYear, model: vehicle?.model },
      filters.sort,
    );
    setVinApplied(applied);
    if (applied.filters) setFilters(applied.filters);
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    writeCatalogParams(filters, url.searchParams);
    window.history.replaceState(window.history.state, "", url);
  }, [filters]);

  useEffect(() => {
    if (detailsVehicle) loadEnrichment(detailsVehicle);
    // A link to a version that is gone (or has no price yet) opens nothing.
    else setDetailsParam(null);
    // Only for the version the page opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bounds = useMemo(() => catalogBounds(entries), [entries]);
  const matches = useMemo(
    () => filterCatalog(entries, deferredFilters),
    [entries, deferredFilters],
  );
  const facets = useMemo(
    () => computeFacets(entries, deferredFilters),
    [entries, deferredFilters],
  );
  const groups = useMemo(
    () => groupCatalog(matches, deferredFilters.sort),
    [matches, deferredFilters.sort],
  );

  // Pagination resets whenever the filters change.
  const filtersKey = JSON.stringify(deferredFilters);
  const visibleCount = page.key === filtersKey ? page.count : pageSize;
  const visibleGroups = groups.slice(0, visibleCount);
  const activeCount = countActiveFilters(filters);
  const chips = activeChips(filters);
  const comparisonIds = new Set(comparison.map((vehicle) => vehicle.id));
  // Compared vehicles → their catalog entries, for the attribute table.
  const pricedEntries = useMemo(() => {
    const byVehicle = new Map<string, CatalogEntry>();
    for (const entry of entries) {
      const vehicle = catalogEntryToVehicle(entry);
      if (vehicle) byVehicle.set(vehicle.id, entry);
    }
    return byVehicle;
  }, [entries]);
  const entryByVehicleId = new Map(pricedEntries);
  for (const [entryId, live] of Object.entries(livePrices)) {
    if (live.status !== "ready") continue;
    const entry = entries.find((item) => item.id === entryId);
    if (entry) entryByVehicleId.set(live.vehicle.id, entry);
  }
  function update(changes: Partial<CatalogFilters>) {
    setFilters((current) => ({ ...current, ...changes }));
  }

  // Crawled price first, then one fetched live from this card.
  function vehicleFor(entry: CatalogEntry): FipeVehicle | null {
    const live = livePrices[entry.id];
    return (
      catalogEntryToVehicle(entry) ??
      (live?.status === "ready" ? live.vehicle : null)
    );
  }

  function isCompared(entry: CatalogEntry) {
    const vehicle = vehicleFor(entry);
    return vehicle !== null && comparisonIds.has(vehicle.id);
  }

  return (
    <>
      <CatalogHeading index={index} />

      <div className="catalog-layout">
        <CatalogFilterPanel
          id="catalog-filters"
          filters={filters}
          facets={facets}
          bounds={bounds}
          activeCount={activeCount}
          resultCount={groups.length}
          open={filtersOpen}
          onChange={update}
          onReset={() => setFilters({ ...emptyCatalogFilters, sort: filters.sort })}
          onClose={() => setFiltersOpen(false)}
        />

        <section className="catalog-results" aria-labelledby="catalog-results-title">
          <VinSearch
            state={vinSearch.state}
            applied={vinApplied}
            onSubmit={(text) => void vinSearch.submit(text)}
            onClear={() => {
              vinSearch.clear();
              setVinApplied(null);
            }}
          />
          <div className="catalog-results-heading">
            <button
              type="button"
              className="catalog-filters-toggle"
              aria-expanded={filtersOpen}
              aria-controls="catalog-filters"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal size={16} /> Filtros
              {activeCount > 0 && <span>{activeCount}</span>}
            </button>
            <h2 id="catalog-results-title" aria-live="polite">
              <strong>{groups.length}</strong>{" "}
              {groups.length === 1 ? "versão" : "versões"}
              <span>
                {" "}
                · {matches.length} {matches.length === 1 ? "ano-modelo" : "anos-modelo"}
              </span>
            </h2>
            <label className="sort-control">
              <span className="sr-only">Ordenar catálogo</span>
              <ArrowDownUp size={15} aria-hidden="true" />
              <select
                value={filters.sort}
                onChange={(event) =>
                  update({ sort: event.target.value as CatalogSort })
                }
              >
                {(Object.keys(sortLabels) as CatalogSort[]).map((sort) => (
                  <option key={sort} value={sort}>
                    {sortLabels[sort]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="active-chips" aria-label="Filtros ativos">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="active-chip"
                  onClick={() => update(chip.remove)}
                  aria-label={`Remover filtro ${chip.label}`}
                >
                  {chip.label} <X size={12} aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                className="link-button"
                onClick={() => setFilters({ ...emptyCatalogFilters, sort: filters.sort })}
              >
                Limpar tudo
              </button>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="empty-results">
              <div className="empty-icon">
                <Search size={22} />
              </div>
              <strong>Nenhuma versão com esses filtros</strong>
              <p>Remova algum filtro ativo para ampliar a busca.</p>
            </div>
          ) : (
            <div className="catalog-grid">
              {visibleGroups.map((group) => (
                <CatalogCard
                  key={group.key}
                  group={group}
                  livePrice={(entry) => livePrices[entry.id]}
                  isCompared={isCompared}
                  canCompare={(entry) => vehicleFor(entry) !== null}
                  comparisonFull={comparison.length >= 4}
                  onFetchPrice={fetchPrice}
                  onToggleCompare={(entry) => {
                    const vehicle = vehicleFor(entry);
                    if (vehicle) onToggleCompare(vehicle);
                  }}
                  onShowDetails={(entry) => {
                    const vehicle = vehicleFor(entry);
                    if (!vehicle) return;
                    loadEnrichment(vehicle);
                    setDetailsVehicle(vehicle);
                    setDetailsParam(entry.id);
                  }}
                />
              ))}
            </div>
          )}

          {groups.length > visibleCount && (
            <button
              type="button"
              className="catalog-more"
              onClick={() =>
                setPage({ key: filtersKey, count: visibleCount + pageSize })
              }
            >
              Mostrar mais {Math.min(pageSize, groups.length - visibleCount)} de{" "}
              {groups.length - visibleCount} restantes
            </button>
          )}
        </section>
      </div>

      <CompareTray
        comparison={comparison}
        onRemove={onToggleCompare}
        onOpen={() => setCompareOpen(true)}
      />
      {detailsVehicle && (
        <VehicleDetailsDialog
          vehicle={detailsVehicle}
          enrichment={enrichmentByVehicle[detailsVehicle.id]}
          onRetry={() => retryEnrichment(detailsVehicle)}
          onClose={closeDetails}
        />
      )}
      {compareOpen && (
        <Suspense fallback={null}>
          <CompareTable
            comparison={comparison}
            entryFor={(vehicle) => entryByVehicleId.get(vehicle.id)}
            onRemove={onToggleCompare}
            onClose={closeCompare}
            onOpenConsulta={onOpenComparison}
          />
        </Suspense>
      )}
    </>
  );
}

export function CatalogPage(props: CatalogPageProps) {
  const state = useCatalogIndex();

  if (state.status === "ready") {
    return <CatalogBrowser {...props} index={state.index} />;
  }

  return (
    <div className="catalog-status">
      {state.status === "loading" && (
        <p>
          <span className="spinner" /> Carregando catálogo...
        </p>
      )}
      {state.status === "missing" && (
        <>
          <strong>O catálogo ainda não foi gerado.</strong>
          <p>
            Rode <code>npm run crawl:fipe</code> e depois{" "}
            <code>npm run build:catalog</code> para criar{" "}
            <code>public/catalog/index.json</code>.
          </p>
        </>
      )}
      {state.status === "error" && (
        <>
          <strong>Não foi possível carregar o catálogo.</strong>
          <p>{state.message}</p>
        </>
      )}
    </div>
  );
}
