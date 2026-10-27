import { energyPriceNote, ipvaNote, ipvaRates, ufs } from "../catalog/costs";
import type { FuelPrices } from "../catalog/costs";
import { formatAnpWeek } from "../catalog/fuelPrices";
import type { CostSettings } from "../services/costSettings";
import { updateCostSettings, useCostSettings } from "../services/costSettings";
import "./CostSettingsPanel.css";

const priceFields: { key: keyof FuelPrices; label: string; unit: string }[] = [
  { key: "gasolina", label: "Gasolina", unit: "R$/L" },
  { key: "etanol", label: "Etanol", unit: "R$/L" },
  { key: "diesel", label: "Diesel", unit: "R$/L" },
  { key: "energia", label: "Energia", unit: "R$/kWh" },
];

const sortedUfs = [...ufs].sort((left, right) =>
  ipvaRates[left].name.localeCompare(ipvaRates[right].name, "pt-BR"),
);

function rateLabel(min: number, max: number) {
  const format = (value: number) => value.toLocaleString("pt-BR");
  return min === max ? `${format(min)}%` : `${format(min)}–${format(max)}%`;
}

/** Where the gasoline, ethanol and diesel prices come from. */
function fuelSourceNote({ uf, anp, custom }: CostSettings): string {
  const edited = Object.keys(custom).length > 0 ? " Os valores que você editou valem até restaurar." : "";
  if (!anp) {
    return `Gasolina, etanol e diesel: média nacional ANP de 11 a 17/10/2026.${edited}`;
  }
  const where = anp.states[uf] ? `dos postos de ${ipvaRates[uf].name}` : "nacional";
  return (
    `Gasolina, etanol e diesel S10: média ANP ${where} na semana de ${formatAnpWeek(anp.week)} ` +
    `(levantamento semanal, dados abertos).${edited}`
  );
}

/** Collapsible editor for the state and fuel prices used in estimates. */
export function CostSettingsPanel() {
  const settings = useCostSettings();
  const { uf, prices, custom } = settings;
  const rate = ipvaRates[uf];

  return (
    <details className="cost-settings">
      <summary>
        Premissas: IPVA {uf} ({rateLabel(rate.min, rate.max)}) · gasolina R${" "}
        {prices.gasolina.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </summary>
      <div className="cost-settings-body">
        <label className="cost-field cost-field-uf">
          <span>Estado (IPVA e combustível)</span>
          <select
            value={uf}
            onChange={(event) => updateCostSettings({ uf: event.target.value as typeof uf })}
          >
            {sortedUfs.map((item) => (
              <option key={item} value={item}>
                {ipvaRates[item].name} — {rateLabel(ipvaRates[item].min, ipvaRates[item].max)}
              </option>
            ))}
          </select>
        </label>
        {priceFields.map(({ key, label, unit }) => (
          <label key={key} className="cost-field">
            <span>
              {label} <small>{unit}</small>
              {custom[key] !== undefined && <small className="cost-field-edited"> · editado</small>}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max="99"
              step="0.01"
              value={prices[key]}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (value > 0 && value < 100) updateCostSettings({ prices: { [key]: value } });
              }}
            />
          </label>
        ))}
        <button
          type="button"
          className="link-button cost-reset"
          onClick={() => updateCostSettings("reset")}
        >
          Restaurar padrão
        </button>
        <p className="cost-note">
          {fuelSourceNote(settings)} {energyPriceNote} {ipvaNote}
        </p>
      </div>
    </details>
  );
}
