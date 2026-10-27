import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { categoryLabel } from "../../constants/categories";
import type { VehicleEnrichmentState } from "../../hooks/useVehicleEnrichment";
import { formatModelYear } from "../../services/fipeParsing";
import type { FipeVehicle } from "../../types/vehicle";
import { VehicleDetails } from "../VehicleDetails";
import "./VehicleDetailsDialog.css";

interface VehicleDetailsDialogProps {
  vehicle: FipeVehicle;
  enrichment: VehicleEnrichmentState | undefined;
  onRetry: () => void;
  onClose: () => void;
}

/** The Consulta's vehicle details (sheet, IPVA, cost, history) for a catalog item. */
export function VehicleDetailsDialog({
  vehicle,
  enrichment,
  onRetry,
  onClose,
}: VehicleDetailsDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="compare-overlay" onClick={onClose}>
      <div
        className="compare-dialog details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="compare-dialog-heading">
          <div className="details-dialog-title">
            <span>
              {vehicle.brand} · {formatModelYear(vehicle.modelYear)} · {vehicle.price}
            </span>
            <h2 id="details-title">{vehicle.model}</h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="catalog-filters-close compare-close"
            onClick={onClose}
            aria-label="Fechar detalhes"
          >
            <X size={18} />
          </button>
        </div>
        <div className="details-dialog-body">
          <VehicleDetails
            id={`catalog-details-${vehicle.id.replaceAll(":", "-")}`}
            vehicle={vehicle}
            categoryLabel={categoryLabel(vehicle.category) ?? "Veículo"}
            enrichment={enrichment}
            onRetryEnrichment={onRetry}
          />
        </div>
      </div>
    </div>
  );
}
