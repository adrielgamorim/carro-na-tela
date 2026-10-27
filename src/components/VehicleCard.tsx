import { Check, ChevronDown, Plus } from "lucide-react";
import { categoryLabel } from "../constants/categories";
import type { VehicleEnrichmentState } from "../hooks/useVehicleEnrichment";
import { formatModelYear } from "../services/fipeParsing";
import type { FipeVehicle } from "../types/vehicle";
import { CategoryIcon } from "./CategoryIcon";
import { VehicleDetails } from "./VehicleDetails";
import "./VehicleCard.css";

interface VehicleCardProps {
  vehicle: FipeVehicle;
  added: boolean;
  full: boolean;
  expanded: boolean;
  enrichment: VehicleEnrichmentState | undefined;
  onToggleDetails: () => void;
  onToggleComparison: () => void;
  onRetryEnrichment: () => void;
}

export function VehicleCard({
  vehicle,
  added,
  full,
  expanded,
  enrichment,
  onToggleDetails,
  onToggleComparison,
  onRetryEnrichment,
}: VehicleCardProps) {
  const label = categoryLabel(vehicle.category) ?? "Veículo";
  const detailsId = `vehicle-details-${vehicle.id.replaceAll(":", "-")}`;

  return (
    <article className="vehicle-card">
      <div className="vehicle-row">
        <div className="vehicle-category-mark" aria-hidden="true">
          <CategoryIcon category={vehicle.category} size={20} />
        </div>
        <div className="vehicle-identity">
          <div className="vehicle-title-line">
            <h3>{vehicle.model}</h3>
            <span className="vehicle-category-label">{label}</span>
          </div>
          <p>
            {vehicle.brand} <span>·</span> {formatModelYear(vehicle.modelYear)} <span>·</span>{" "}
            {vehicle.fuel}
          </p>
          <small>
            FIPE {vehicle.codeFipe} <span>·</span> {vehicle.referenceMonth}
          </small>
        </div>
        <div className="vehicle-price">
          <span>VALOR FIPE</span>
          <strong>{vehicle.price}</strong>
        </div>
        <button
          type="button"
          className={`expand-action${expanded ? " expand-action-open" : ""}`}
          onClick={onToggleDetails}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "Ocultar" : "Mostrar"} detalhes de ${vehicle.brand} ${vehicle.model}`}
          title={expanded ? "Ocultar detalhes" : "Ver mais detalhes"}
        >
          <ChevronDown size={17} />
        </button>
        <button
          type="button"
          className={`compare-action${added ? " compare-action-added" : ""}`}
          onClick={onToggleComparison}
          disabled={full}
          aria-label={
            added
              ? `Remover ${vehicle.brand} ${vehicle.model} da comparação`
              : `Adicionar ${vehicle.brand} ${vehicle.model} à comparação`
          }
          aria-pressed={added}
          title={
            full
              ? "A comparação aceita até 4 veículos"
              : added
                ? "Remover da comparação"
                : "Adicionar à comparação"
          }
        >
          {added ? <Check size={17} /> : <Plus size={17} />}
        </button>
      </div>
      {expanded && (
        <VehicleDetails
          id={detailsId}
          vehicle={vehicle}
          categoryLabel={label}
          enrichment={enrichment}
          onRetryEnrichment={onRetryEnrichment}
        />
      )}
    </article>
  );
}
