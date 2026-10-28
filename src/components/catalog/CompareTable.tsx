import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  bodyLabel,
  engineLabel,
  formatKmL,
  propulsionLabels,
  sizeLabels,
  steeringLabels,
  transmissionLabel,
} from "../../catalog/labels";
import { costPerKm, estimateIpva, formatIpva, formatPerKm } from "../../catalog/costs";
import { formatTorque, formatTrunk } from "../../catalog/press";
import type { CatalogEntry } from "../../catalog/types";
import { formatSpec, specLabels } from "../../catalog/wikidata";
import { formatModelYear } from "../../services/fipeParsing";
import { useCostSettings } from "../../services/costSettings";
import type { CostSettings } from "../../services/costSettings";
import type { FipeVehicle } from "../../types/vehicle";
import { CostSettingsPanel } from "../CostSettingsPanel";
import "./compareTable.css";

interface CompareTableProps {
  comparison: FipeVehicle[];
  /** Catalog data for a compared vehicle, when it came from the catalog. */
  entryFor: (vehicle: FipeVehicle) => CatalogEntry | undefined;
  onRemove: (vehicle: FipeVehicle) => void;
  onClose: () => void;
  /** Link to the Consulta FIPE comparator; omitted when already there. */
  onOpenConsulta?: () => void;
}

interface Row {
  label: string;
  value: (vehicle: FipeVehicle, entry: CatalogEntry | undefined) => string | null;
  /** Numeric value for highlighting the best column. */
  score?: (vehicle: FipeVehicle, entry: CatalogEntry | undefined) => number | null;
  best?: "min" | "max";
}

const yesNo = (value: boolean | null | undefined) =>
  value === true ? "Sim" : value === false ? "Não" : null;

/** Rows that depend on the viewer's cost assumptions. */
function costRows({ uf, prices }: CostSettings): Row[] {
  const ipva = (vehicle: FipeVehicle) =>
    vehicle.category === "cars" && vehicle.priceValue > 0
      ? estimateIpva(vehicle.priceValue, uf)
      : null;
  const cost = (entry: CatalogEntry | undefined) => costPerKm(entry?.inmetro, prices);
  return [
    {
      label: `IPVA estimado (${uf})`,
      value: (vehicle) => {
        const estimate = ipva(vehicle);
        return estimate ? formatIpva(estimate) : null;
      },
      score: (vehicle) => ipva(vehicle)?.min ?? null,
      best: "min",
    },
    {
      label: "Custo por km (uso misto)",
      value: (_, entry) => {
        const estimate = cost(entry);
        return estimate ? formatPerKm(estimate.best) : null;
      },
      score: (_, entry) => cost(entry)?.best.perKm ?? null,
      best: "min",
    },
  ];
}

const rows: Row[] = [
  {
    label: "Preço FIPE",
    value: (vehicle) => vehicle.price,
    score: (vehicle) => vehicle.priceValue,
    best: "min",
  },
  {
    label: "Ano-modelo",
    value: (vehicle) => formatModelYear(vehicle.modelYear),
  },
  { label: "Combustível", value: (vehicle) => vehicle.fuel },
  { label: "Propulsão", value: (_, entry) => (entry ? propulsionLabels[entry.propulsion] : null) },
  { label: "Motor", value: (_, entry) => (entry ? engineLabel(entry) : null) },
  {
    label: "Potência",
    value: (_, entry) =>
      entry?.attributes.powerCv
        ? `${entry.attributes.powerCv} cv`
        : entry?.wikidata?.specs?.power
          ? formatSpec("power", entry.wikidata.specs.power)
          : null,
    score: (_, entry) => entry?.attributes.powerCv ?? null,
    best: "max",
  },
  { label: "Câmbio", value: (_, entry) => (entry ? transmissionLabel(entry) : null) },
  { label: "Configuração", value: (_, entry) => (entry ? bodyLabel(entry) : null) },
  { label: "Porte", value: (_, entry) => (entry?.size ? sizeLabels[entry.size] : null) },
  // From the carmaker's press releases (Stellantis brands only).
  {
    label: "Porta-malas",
    value: (_, entry) => (entry?.press?.trunk ? formatTrunk(entry.press.trunk.value) : null),
    score: (_, entry) => entry?.press?.trunk?.value ?? null,
    best: "max",
  },
  {
    label: "Torque",
    value: (_, entry) => (entry?.press?.torque ? formatTorque(entry.press.torque.value) : null),
    score: (_, entry) => entry?.press?.torque?.value ?? null,
    best: "max",
  },
  // Approximate: the model line's size and mass (Wikidata).
  ...(["length", "wheelbase", "mass"] as const).map((key): Row => ({
    label: specLabels.find(([item]) => item === key)?.[1] ?? key,
    value: (_, entry) => {
      const range = entry?.wikidata?.specs?.[key];
      return range ? formatSpec(key, range) : null;
    },
  })),
  {
    label: "Portas",
    value: (_, entry) => (entry?.attributes.doors ? String(entry.attributes.doors) : null),
  },
  {
    label: "Consumo na cidade",
    value: (_, entry) => (entry?.cityKmL != null ? formatKmL(entry.cityKmL) : null),
    score: (_, entry) => entry?.cityKmL ?? null,
    best: "max",
  },
  {
    label: "Consumo na estrada",
    value: (_, entry) => (entry?.highwayKmL != null ? formatKmL(entry.highwayKmL) : null),
    score: (_, entry) => entry?.highwayKmL ?? null,
    best: "max",
  },
  {
    label: "Etanol na cidade",
    value: (_, entry) => {
      const value = entry?.inmetro?.consumption.ethanolCity;
      return value != null ? formatKmL(value) : null;
    },
    score: (_, entry) => entry?.inmetro?.consumption.ethanolCity ?? null,
    best: "max",
  },
  {
    label: "Autonomia elétrica",
    value: (_, entry) => (entry?.inmetro?.rangeKm ? `${entry.inmetro.rangeKm} km` : null),
    score: (_, entry) => entry?.inmetro?.rangeKm ?? null,
    best: "max",
  },
  {
    label: "Direção",
    value: (_, entry) => (entry?.steering ? steeringLabels[entry.steering] : null),
  },
  { label: "Ar-condicionado", value: (_, entry) => yesNo(entry?.airConditioning) },
  {
    label: "Dados INMETRO",
    value: (_, entry) =>
      entry?.inmetro
        ? `${entry.inmetro.table} · ${entry.inmetro.confidence === "exact" ? "versão exata" : "versão aproximada"}`
        : null,
  },
];

export function CompareTable({
  comparison,
  entryFor,
  onRemove,
  onClose,
  onOpenConsulta,
}: CompareTableProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const settings = useCostSettings();
  // The price first, then the costs, then the rest.
  const allRows = [...rows.slice(0, 1), ...costRows(settings), ...rows.slice(1)];
  const columns = comparison.map((vehicle) => ({ vehicle, entry: entryFor(vehicle) }));
  const visibleRows = allRows.filter((row) =>
    columns.some(({ vehicle, entry }) => row.value(vehicle, entry) !== null),
  );

  function bestColumn(row: Row): number | null {
    if (!row.score || !row.best || columns.length < 2) return null;
    const scores = columns.map(({ vehicle, entry }) => row.score!(vehicle, entry));
    const known = scores.filter((score): score is number => score !== null);
    if (known.length < 2) return null;
    const target = row.best === "min" ? Math.min(...known) : Math.max(...known);
    // No highlight when every known value ties.
    if (known.every((score) => score === target)) return null;
    return scores.indexOf(target);
  }

  return (
    <div className="compare-overlay" onClick={onClose}>
      <div
        className="compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="compare-dialog-heading">
          <h2 id="compare-title">Comparação lado a lado</h2>
          {onOpenConsulta && (
            <button type="button" className="link-button" onClick={onOpenConsulta}>
              Abrir na Consulta FIPE
            </button>
          )}
          <button
            ref={closeButton}
            type="button"
            className="catalog-filters-close compare-close"
            onClick={onClose}
            aria-label="Fechar comparação"
          >
            <X size={18} />
          </button>
        </div>

        {comparison.length === 0 ? (
          <p className="compare-empty">Nenhum veículo na comparação.</p>
        ) : (
          <div className="compare-scroll">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Atributo</span>
                  </th>
                  {columns.map(({ vehicle }) => (
                    <th key={vehicle.id} scope="col">
                      <span>{vehicle.brand}</span>
                      <strong>{vehicle.model}</strong>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => onRemove(vehicle)}
                      >
                        Remover
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const best = bestColumn(row);
                  return (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {columns.map(({ vehicle, entry }, index) => (
                        <td
                          key={vehicle.id}
                          className={index === best ? "compare-best" : undefined}
                        >
                          {row.value(vehicle, entry) ?? "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="compare-settings">
          <CostSettingsPanel />
        </div>
        <p className="compare-note">
          Destaque = melhor valor da linha. Consumo, custo por km, porte, direção e ar
          vêm da tabela INMETRO; porta-malas e torque, dos releases da Stellantis (só
          Fiat, Jeep, Citroën, Peugeot, RAM e Leapmotor); IPVA e custo por km são
          estimativas pelas premissas acima; “—” indica dado indisponível para a versão.
        </p>
      </div>
    </div>
  );
}
