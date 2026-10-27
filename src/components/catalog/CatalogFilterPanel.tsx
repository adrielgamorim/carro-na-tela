import { Search, X } from "lucide-react";
import type {
  CatalogBounds,
  CatalogFacets,
  CatalogFilters,
  FacetOption,
  ListFacet,
  ToggleFacet,
} from "../../catalog/filters";
import type { SizeClass } from "../../catalog/inmetro";
import {
  bodyLabels,
  propulsionLabels,
  sizeLabels,
  originLabels,
  steeringLabels,
  transmissionLabels,
} from "../../catalog/labels";
import { CheckList, ChipGroup } from "./facetControls";
import { asIs, fromRecord, parseNumber, toggleValue } from "./facetValues";
import type { Labeler } from "./facetValues";
import "./CatalogFilterPanel.css";

const sizeOrder: SizeClass[] = [
  "subcompacto",
  "compacto",
  "medio",
  "grande",
  "extra-grande",
];
const consumptionSteps = [8, 10, 12, 14, 16, 20, 30];

interface CatalogFilterPanelProps {
  id: string;
  filters: CatalogFilters;
  facets: CatalogFacets;
  bounds: CatalogBounds;
  activeCount: number;
  resultCount: number;
  open: boolean;
  onChange: (changes: Partial<CatalogFilters>) => void;
  onReset: () => void;
  onClose: () => void;
}

export function CatalogFilterPanel({
  id,
  filters,
  facets,
  bounds,
  activeCount,
  resultCount,
  open,
  onChange,
  onReset,
  onClose,
}: CatalogFilterPanelProps) {
  const years: number[] = [];
  if (bounds.yearMin !== null && bounds.yearMax !== null) {
    for (let year = bounds.yearMax; year >= bounds.yearMin; year -= 1) {
      years.push(year);
    }
  }

  function listFacet(facet: ListFacet, label: Labeler) {
    return {
      options: facets.lists[facet],
      selected: filters[facet] as string[],
      label,
      onToggle: (value: string) =>
        onChange({
          [facet]: toggleValue(filters[facet] as string[], value),
        } as Partial<CatalogFilters>),
    };
  }

  function toggle(facet: ToggleFacet, label: string) {
    const checked = filters[facet];
    const count = facets.toggles[facet];
    return (
      <label
        className={`facet-toggle${count === 0 && !checked ? " facet-disabled" : ""}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={count === 0 && !checked}
          onChange={() => onChange({ [facet]: !checked })}
        />
        <span>{label}</span>
        <small>{count}</small>
      </label>
    );
  }

  return (
    <aside
      id={id}
      className={`catalog-filters${open ? " catalog-filters-open" : ""}`}
      aria-label="Filtros do catálogo"
    >
      <div className="catalog-filters-heading">
        <h2>
          Filtros {activeCount > 0 && <span>{activeCount}</span>}
        </h2>
        {activeCount > 0 && (
          <button type="button" className="link-button" onClick={onReset}>
            Limpar
          </button>
        )}
        <button
          type="button"
          className="catalog-filters-close"
          onClick={onClose}
          aria-label="Fechar filtros"
        >
          <X size={18} />
        </button>
      </div>

      <div className="catalog-filters-body">
        <label className="catalog-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="Modelo, versão ou código FIPE"
            aria-label="Buscar no catálogo"
          />
        </label>

        <details className="facet-group" open>
          <summary>Essenciais</summary>
          <div className="facet-field">
            <span className="facet-label">Marca</span>
            <CheckList {...listFacet("brands", asIs)} searchLabel="Buscar marca" />
          </div>
          <div className="facet-field">
            <span className="facet-label">Linha / modelo</span>
            <CheckList
              {...listFacet("families", asIs)}
              hideEmpty
              searchLabel="Buscar linha"
            />
          </div>
          <div className="facet-field">
            <span className="facet-label" title="Pela parcela da frota da linha registrada como importada (Senatran)">
              Procedência
            </span>
            <ChipGroup {...listFacet("origins", fromRecord(originLabels))} />
          </div>
          <div className="facet-field">
            <span className="facet-label">Configuração</span>
            <ChipGroup {...listFacet("bodies", fromRecord(bodyLabels))} />
          </div>
          <div className="facet-field">
            <span className="facet-label">Ano-modelo</span>
            <div className="facet-range">
              <select
                aria-label="Ano mínimo"
                value={filters.yearMin ?? ""}
                onChange={(event) =>
                  onChange({ yearMin: parseNumber(event.target.value) })
                }
              >
                <option value="">De</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <span>até</span>
              <select
                aria-label="Ano máximo"
                value={filters.yearMax ?? ""}
                onChange={(event) =>
                  onChange({ yearMax: parseNumber(event.target.value) })
                }
              >
                <option value="">0 km</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            {toggle("zeroKmOnly", "Somente 0 km")}
          </div>
          <div className="facet-field">
            <span className="facet-label">Preço FIPE (R$)</span>
            <div className="facet-range">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="5000"
                aria-label="Preço mínimo em reais"
                placeholder={String(Math.floor(bounds.priceMin / 1000) * 1000)}
                value={filters.priceMin ?? ""}
                onChange={(event) =>
                  onChange({ priceMin: parseNumber(event.target.value) })
                }
              />
              <span>até</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="5000"
                aria-label="Preço máximo em reais"
                placeholder={String(Math.ceil(bounds.priceMax / 1000) * 1000)}
                value={filters.priceMax ?? ""}
                onChange={(event) =>
                  onChange({ priceMax: parseNumber(event.target.value) })
                }
              />
            </div>
          </div>
        </details>

        <details className="facet-group" open>
          <summary>Propulsão e energia</summary>
          <div className="facet-field">
            <span className="facet-label">Propulsão</span>
            <ChipGroup {...listFacet("propulsions", fromRecord(propulsionLabels))} />
          </div>
          <div className="facet-field">
            <span className="facet-label">Combustível</span>
            <ChipGroup {...listFacet("fuels", asIs)} />
          </div>
        </details>

        <details className="facet-group" open>
          <summary>Motor e câmbio</summary>
          <div className="facet-field">
            <span className="facet-label">Câmbio</span>
            <ChipGroup
              {...listFacet("transmissions", fromRecord(transmissionLabels))}
            />
          </div>
          <div className="facet-field">
            <span className="facet-label">Marchas</span>
            <ChipGroup
              {...listFacet("gears", (value) => `${value} marchas`)}
              options={[...facets.lists.gears].sort((a, b) => Number(a.value) - Number(b.value))}
            />
          </div>
          <div className="facet-field">
            <span className="facet-label">Cilindrada (litros)</span>
            <div className="facet-range">
              <select
                aria-label="Cilindrada mínima"
                value={filters.engineMin ?? ""}
                onChange={(event) =>
                  onChange({ engineMin: parseNumber(event.target.value) })
                }
              >
                <option value="">De</option>
                {bounds.engines.map((liters) => (
                  <option key={liters} value={liters}>
                    {liters.toFixed(1)}
                  </option>
                ))}
              </select>
              <span>até</span>
              <select
                aria-label="Cilindrada máxima"
                value={filters.engineMax ?? ""}
                onChange={(event) =>
                  onChange({ engineMax: parseNumber(event.target.value) })
                }
              >
                <option value="">Até</option>
                {bounds.engines.map((liters) => (
                  <option key={liters} value={liters}>
                    {liters.toFixed(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="facet-field">
            {toggle("turbo", "Motor turbo")}
            {toggle("fourWheelDrive", "Tração 4x4 / integral")}
          </div>
        </details>

        <details className="facet-group">
          <summary>Carroceria e porte</summary>
          <div className="facet-field">
            <span className="facet-label">Porte</span>
            <ChipGroup
              {...listFacet("sizes", fromRecord(sizeLabels))}
              options={sizeOrder
                .map((size) => facets.lists.sizes.find((option) => option.value === size))
                .filter((option): option is FacetOption => option !== undefined)}
            />
          </div>
          <div className="facet-field">
            <span className="facet-label">Portas</span>
            <ChipGroup {...listFacet("doors", (value) => `${value} portas`)} />
          </div>
        </details>

        <details className="facet-group">
          <summary>Consumo e conforto</summary>
          <div className="facet-field">
            <span className="facet-label">Consumo na cidade (INMETRO)</span>
            <select
              className="facet-select"
              aria-label="Consumo mínimo na cidade"
              value={filters.consumptionMin ?? ""}
              onChange={(event) =>
                onChange({ consumptionMin: parseNumber(event.target.value) })
              }
            >
              <option value="">Qualquer consumo</option>
              {consumptionSteps.map((value) => (
                <option key={value} value={value}>
                  Pelo menos {value} km/l
                </option>
              ))}
            </select>
          </div>
          <div className="facet-field">
            <span className="facet-label">Direção</span>
            <ChipGroup {...listFacet("steerings", fromRecord(steeringLabels))} />
          </div>
          <div className="facet-field">
            {toggle("airConditioning", "Ar-condicionado")}
          </div>
        </details>

        <p className="facet-note">
          Motor e parte do câmbio vêm do nome FIPE; porte, marchas, consumo,
          direção e ar vêm da tabela INMETRO 2026 e só existem para versões
          recentes encontradas nela.
        </p>
      </div>

      <div className="catalog-filters-footer">
        <button type="button" onClick={onClose}>
          Ver {resultCount} {resultCount === 1 ? "versão" : "versões"}
        </button>
      </div>
    </aside>
  );
}
