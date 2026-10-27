import { Scale, X } from "lucide-react";
import { formatModelYear } from "../../services/fipeParsing";
import type { FipeVehicle } from "../../types/vehicle";
import "./CompareTray.css";

interface CompareTrayProps {
  comparison: FipeVehicle[];
  onRemove: (vehicle: FipeVehicle) => void;
  onOpen: () => void;
}

export function CompareTray({ comparison, onRemove, onOpen }: CompareTrayProps) {
  if (comparison.length === 0) return null;

  return (
    <div className="compare-tray" role="region" aria-label="Veículos para comparar">
      <ul>
        {comparison.map((vehicle) => (
          <li key={vehicle.id}>
            <span>
              {vehicle.model}
              <small>
                {formatModelYear(vehicle.modelYear)}
              </small>
            </span>
            <button
              type="button"
              onClick={() => onRemove(vehicle)}
              aria-label={`Remover ${vehicle.model} da comparação`}
            >
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="compare-tray-open" onClick={onOpen}>
        <Scale size={16} /> Comparar {comparison.length}/4
      </button>
    </div>
  );
}
