import { Scale, Table2, X } from "lucide-react";
import { formatModelYear } from "../services/fipeParsing";
import type { FipeVehicle } from "../types/vehicle";
import "./ComparisonPanel.css";

interface ComparisonPanelProps {
  comparison: FipeVehicle[];
  onRemove: (vehicle: FipeVehicle) => void;
  onClear: () => void;
  onOpenTable: () => void;
}

export function ComparisonPanel({
  comparison,
  onRemove,
  onClear,
  onOpenTable,
}: ComparisonPanelProps) {
  const cheapest = comparison.reduce<FipeVehicle | null>(
    (lowest, vehicle) =>
      !lowest || vehicle.priceValue < lowest.priceValue ? vehicle : lowest,
    null,
  );
  const highestPrice = comparison.reduce(
    (highest, vehicle) => Math.max(highest, vehicle.priceValue),
    0,
  );

  return (
    <aside
      className="comparison-panel"
      id="comparacao"
      aria-labelledby="comparison-title"
    >
      <div className="comparison-heading">
        <div className="comparison-icon">
          <Scale size={19} />
        </div>
        <div>
          <p className="eyebrow">SUA SELEÇÃO</p>
          <h2 id="comparison-title">
            Comparador <span>{comparison.length}/4</span>
          </h2>
        </div>
      </div>
      {comparison.length === 0 ? (
        <div className="comparison-empty">
          <div className="empty-glyph">
            <Scale size={24} />
          </div>
          <strong>Pronto para comparar</strong>
          <p>Adicione veículos consultados para ver os valores lado a lado.</p>
        </div>
      ) : (
        <div className="comparison-items">
          {comparison.map((vehicle, index) => (
            <article className="comparison-item" key={vehicle.id}>
              <span className="comparison-index">0{index + 1}</span>
              <div className="comparison-item-copy">
                <strong>{vehicle.model}</strong>
                <span>
                  {vehicle.brand} · {formatModelYear(vehicle.modelYear)}
                </span>
                <b>{vehicle.price}</b>
                <small>{vehicle.referenceMonth}</small>
              </div>
              <button
                type="button"
                className="remove-vehicle"
                onClick={() => onRemove(vehicle)}
                aria-label={`Remover ${vehicle.brand} ${vehicle.model}`}
                title="Remover da comparação"
              >
                <X size={16} />
              </button>
            </article>
          ))}
          {comparison.length > 1 && cheapest && (
            <div className="price-difference">
              <div>
                <span>MENOR VALOR</span>
                <strong>{cheapest.price}</strong>
              </div>
              <div>
                <span>DIFERENÇA</span>
                <strong>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  }).format(highestPrice - cheapest.priceValue)}
                </strong>
              </div>
            </div>
          )}
          <button type="button" className="open-compare-table" onClick={onOpenTable}>
            <Table2 size={15} /> Ver tabela comparativa
          </button>
          <button type="button" className="clear-comparison" onClick={onClear}>
            Limpar comparação <X size={14} />
          </button>
        </div>
      )}
      <div className="comparison-note">
        <span className="note-accent" />
        <p>
          Cada valor corresponde à referência FIPE e ao mês exibido no veículo.
        </p>
      </div>
      <div className="comparison-bottomline">
        <span>CARRO NA TELA</span>
        <span>SESSÃO ATUAL</span>
      </div>
    </aside>
  );
}
