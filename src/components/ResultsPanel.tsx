import { useState } from "react";
import { ArrowDownUp, Search, SlidersHorizontal, X } from "lucide-react";
import { categories } from "../constants/categories";
import { useVehicleEnrichment } from "../hooks/useVehicleEnrichment";
import { filterVehicles, formatModelYear } from "../services/fipe";
import type { FipeVehicle, VehicleCategory } from "../types/vehicle";
import { VehicleCard } from "./VehicleCard";
import "./ResultsPanel.css";

interface ResultsPanelProps {
  consulted: FipeVehicle[];
  comparison: FipeVehicle[];
  onToggleComparison: (vehicle: FipeVehicle) => void;
  onClearConsulted: () => void;
}

export function ResultsPanel({
  consulted,
  comparison,
  onToggleComparison,
  onClearConsulted,
}: ResultsPanelProps) {
  const [expandedVehicleIds, setExpandedVehicleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const { enrichmentByVehicle, loadEnrichment, retryEnrichment } = useVehicleEnrichment();
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filterCategory, setFilterCategory] = useState<VehicleCategory | "all">(
    "all",
  );
  const [filterBrand, setFilterBrand] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [sortOrder, setSortOrder] = useState("recent");

  const minValue = minPrice === "" ? null : Number(minPrice);
  const maxValue = maxPrice === "" ? null : Number(maxPrice);
  const filterBrands = [
    ...new Set(consulted.map((vehicle) => vehicle.brand)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filterModels = [
    ...new Set(consulted.map((vehicle) => vehicle.model)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filterYears = [
    ...new Set(consulted.map((vehicle) => vehicle.modelYear)),
  ].sort((a, b) => b - a);
  const matches = filterVehicles(consulted, {
    query,
    minPrice: minValue,
    maxPrice: maxValue,
    category: filterCategory,
    brand: filterBrand,
    model: filterModel,
    modelYear: filterYear === "" ? null : Number(filterYear),
  });
  const results =
    sortOrder === "price-low"
      ? [...matches].sort((a, b) => a.priceValue - b.priceValue)
      : sortOrder === "price-high"
        ? [...matches].sort((a, b) => b.priceValue - a.priceValue)
        : matches;

  function clearConsulted() {
    setExpandedVehicleIds(new Set());
    onClearConsulted();
  }

  function toggleVehicleDetails(vehicle: FipeVehicle) {
    const isExpanded = expandedVehicleIds.has(vehicle.id);
    setExpandedVehicleIds((expanded) => {
      const nextExpanded = new Set(expanded);
      if (isExpanded) nextExpanded.delete(vehicle.id);
      else nextExpanded.add(vehicle.id);
      return nextExpanded;
    });

    if (!isExpanded) loadEnrichment(vehicle);
  }

  return (
    <section className="results-panel" aria-labelledby="results-title">
      <div className="results-heading">
        <div className="results-title-group">
          <div className="step-number step-number-muted">02</div>
          <div>
            <h2 id="results-title">Veículos consultados</h2>
            <p>
              {consulted.length}{" "}
              {consulted.length === 1 ? "consulta salva" : "consultas salvas"}{" "}
              neste navegador
            </p>
          </div>
        </div>
        <div className="results-actions">
          {consulted.length > 0 && (
            <button
              type="button"
              className="clear-consulted"
              onClick={clearConsulted}
            >
              Limpar consultas <X size={13} />
            </button>
          )}
          <div className="result-total">
            <span>{results.length}</span> RESULTADOS
          </div>
        </div>
      </div>
      <div className="filter-bar">
        <label className="result-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Marca, modelo ou código FIPE"
            aria-label="Buscar nas consultas realizadas"
          />
        </label>
        <div
          className="price-filter-group"
          aria-label="Filtrar por faixa de preço"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          <label className="price-input-wrap">
            <span className="sr-only">Preço mínimo em reais</span>
            <span>R$</span>
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="Mínimo"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
            />
          </label>
          <span className="range-separator">até</span>
          <label className="price-input-wrap">
            <span className="sr-only">Preço máximo em reais</span>
            <span>R$</span>
            <input
              type="number"
              min="0"
              step="1000"
              placeholder="Máximo"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
          </label>
        </div>
        <label className="sort-control">
          <span className="sr-only">Ordenar resultados</span>
          <ArrowDownUp size={15} aria-hidden="true" />
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          >
            <option value="recent">Recentes</option>
            <option value="price-low">Menor preço</option>
            <option value="price-high">Maior preço</option>
          </select>
        </label>
      </div>
      <div className="advanced-filter-bar" aria-label="Filtros detalhados">
        <label>
          <span>Categoria</span>
          <select
            value={filterCategory}
            onChange={(event) =>
              setFilterCategory(event.target.value as VehicleCategory | "all")
            }
          >
            <option value="all">Todas</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Marca</span>
          <select
            value={filterBrand}
            onChange={(event) => setFilterBrand(event.target.value)}
          >
            <option value="">Todas</option>
            {filterBrands.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Modelo</span>
          <select
            value={filterModel}
            onChange={(event) => setFilterModel(event.target.value)}
          >
            <option value="">Todos</option>
            {filterModels.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ano</span>
          <select
            value={filterYear}
            onChange={(event) => setFilterYear(event.target.value)}
          >
            <option value="">Todos</option>
            {filterYears.map((item) => (
              <option key={item} value={item}>
                {formatModelYear(item)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="vehicle-list" aria-live="polite">
        {results.map((vehicle) => {
          const added = comparison.some((item) => item.id === vehicle.id);
          return (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              added={added}
              full={comparison.length >= 4 && !added}
              expanded={expandedVehicleIds.has(vehicle.id)}
              enrichment={enrichmentByVehicle[vehicle.id]}
              onToggleDetails={() => toggleVehicleDetails(vehicle)}
              onToggleComparison={() => onToggleComparison(vehicle)}
              onRetryEnrichment={() => retryEnrichment(vehicle)}
            />
          );
        })}
        {results.length === 0 && (
          <div className="empty-results">
            <div className="empty-icon">
              <Search size={22} />
            </div>
            <strong>
              {consulted.length === 0
                ? "Nenhuma consulta por aqui"
                : "Nenhum veículo encontrado"}
            </strong>
            <p>
              {consulted.length === 0
                ? "Os veículos pesquisados serão listados nesta área."
                : "Ajuste o texto ou a faixa de preço."}
            </p>
          </div>
        )}
      </div>
      <div className="results-footer">
        <span>
          <span className="footer-dot" /> Preços baseados na tabela FIPE
          selecionada
        </span>
        <span>Atualizado por referência mensal</span>
      </div>
    </section>
  );
}
