import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
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
import type { PageLink } from "./CatalogCard";
import { CatalogHeading } from "./CatalogHeading";
import { CatalogFilterPanel } from "./CatalogFilterPanel";
import { CompareTray } from "./CompareTray";
import { VinSearch } from "./VinSearch";
import { VehiclePage } from "./VehiclePage";
import "./catalog.css";
import "./CatalogPage.css";

const pageSize = 24;

// Opened on demand; shared with the Consulta FIPE.
const CompareTable = lazy(() =>
  import("./CompareTable").then((module) => ({ default: module.CompareTable })),
);

// A version's page is /?versao=<entry id>; the list keeps its filters in memory
// behind it, so the browser's back button returns to the same spot.
const detailsParam = "versao";
const readOpenId = () => new URLSearchParams(window.location.search).get(detailsParam);

/** Plain left click → handled here; ctrl/shift/middle click → the browser (new tab). */
function linkTo(href: string, open: () => void): PageLink {
  return {
    href,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      open();
    },
  };
}

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
  const [filters, setFilters] = useState<CatalogFilters>(() => {
    const read = readCatalogParams(new URLSearchParams(window.location.search));
    // Links from before lines were spelled once per brand ("linha=UNO" → "Uno").
    const spelling = new Map(index.entries.map((entry) => [entry.family.toLocaleLowerCase("pt-BR"), entry.family]));
    return {
      ...read,
      families: read.families.map((family) => spelling.get(family.toLocaleLowerCase("pt-BR")) ?? family),
    };
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState({ key: "", count: pageSize });
  const [compareOpen, setCompareOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(readOpenId);
  // Where the list was scrolled when a version's page opened.
  const listScroll = useRef(0);
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
    // A version's page has a URL of its own; the filters come back with the list.
    if (openId) return;
    const url = new URL(window.location.href);
    writeCatalogParams(filters, url.searchParams);
    window.history.replaceState(window.history.state, "", url);
  }, [filters, openId]);

  // Back and forward move between the list and versions' pages.
  useEffect(() => {
    const handlePopState = () => {
      const id = readOpenId();
      setOpenId(id);
      window.setTimeout(() => window.scrollTo({ top: id ? 0 : listScroll.current }));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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

  const openEntry = openId ? entries.find((entry) => entry.id === openId) : undefined;
  const openVehicle = openEntry ? vehicleFor(openEntry) : null;
  const openVehicleId = openVehicle?.id;
  useEffect(() => {
    if (openVehicle) loadEnrichment(openVehicle);
    // Once per vehicle; loadEnrichment itself skips a loaded one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openVehicleId]);

  const pageUrl = (entry: CatalogEntry) =>
    `${window.location.pathname}?${detailsParam}=${encodeURIComponent(entry.id)}`;

  // From the list: a new history entry, so "back" returns to it. Between years
  // of the same version the entry is replaced, so "back" still goes to the list.
  function openPage(entry: CatalogEntry, replace = false) {
    if (!openId) listScroll.current = window.scrollY;
    if (replace) window.history.replaceState(window.history.state, "", pageUrl(entry));
    else window.history.pushState({ fromCatalog: true }, "", pageUrl(entry));
    setOpenId(entry.id);
    // After the render that swaps the list for the page.
    window.setTimeout(() => window.scrollTo({ top: 0 }));
  }

  function closePage() {
    // Opened from the list: go back to it, filters and scroll included.
    if ((window.history.state as { fromCatalog?: boolean } | null)?.fromCatalog) {
      window.history.back();
      return;
    }
    // Opened from a shared link: there is no list behind it yet.
    window.history.pushState(null, "", window.location.pathname);
    setOpenId(null);
    // After the list renders.
    window.setTimeout(() => window.scrollTo({ top: 0 }));
  }

  function isCompared(entry: CatalogEntry) {
    const vehicle = vehicleFor(entry);
    return vehicle !== null && comparisonIds.has(vehicle.id);
  }

  let versionPage: ReactNode = null;
  if (openId) {
    const years = openEntry
      ? (groupCatalog(
          entries.filter(
            (entry) =>
              entry.category === openEntry.category &&
              entry.brandCode === openEntry.brandCode &&
              entry.modelCode === openEntry.modelCode,
          ),
          "newest",
        )[0]?.entries ?? [openEntry])
      : [];
    const backLink = linkTo(window.location.pathname, closePage);
    versionPage = openEntry ? (
      <VehiclePage
        entry={openEntry}
        years={years}
        vehicle={openVehicle}
        live={livePrices[openEntry.id]}
        enrichment={openVehicle ? enrichmentByVehicle[openVehicle.id] : undefined}
        compared={isCompared(openEntry)}
        comparisonFull={comparison.length >= 4}
        backLink={backLink}
        yearLink={(entry) => linkTo(pageUrl(entry), () => openPage(entry, true))}
        onFetchPrice={() => fetchPrice(openEntry)}
        onToggleCompare={() => {
          if (openVehicle) onToggleCompare(openVehicle);
        }}
        onRetryEnrichment={() => {
          if (openVehicle) retryEnrichment(openVehicle);
        }}
      />
    ) : (
      <div className="empty-results">
        <strong>Versão não encontrada</strong>
        <p>Ela pode ter saído da tabela FIPE. Procure o modelo no catálogo.</p>
        <a className="link-button" {...backLink}>
          Ir para o catálogo
        </a>
      </div>
    );
  }

  return (
    <>
      {versionPage}
      {/* Kept mounted behind a version's page: filters, picked years and "mostrar mais" survive. */}
      <div hidden={openId !== null}>
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
                    pageLink={(entry) => linkTo(pageUrl(entry), () => openPage(entry))}
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
      </div>

      <CompareTray
        comparison={comparison}
        onRemove={onToggleCompare}
        onOpen={() => setCompareOpen(true)}
      />
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
