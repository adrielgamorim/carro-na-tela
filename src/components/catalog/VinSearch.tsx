import { useState } from "react";
import { ScanLine, X } from "lucide-react";
import type { VinFilterResult } from "../../catalog/vinFilters";
import type { VinSearchState } from "../../hooks/useVinSearch";
import "./VinSearch.css";

interface VinSearchProps {
  state: VinSearchState;
  /** Filters the last decoded chassis applied to the catalog. */
  applied: VinFilterResult | null;
  onSubmit: (text: string) => void;
  onClear: () => void;
}

export function VinSearch({ state, applied, onSubmit, onClear }: VinSearchProps) {
  const [text, setText] = useState("");
  const loading = state.status === "loading";

  return (
    <section className="vin-search" aria-labelledby="vin-search-title">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(text);
        }}
      >
        <label className="vin-search-field">
          <span id="vin-search-title" className="facet-label">
            Buscar pelo chassi (VIN)
          </span>
          <span className="catalog-search">
            <ScanLine size={16} aria-hidden="true" />
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ex.: 9BWAB45U0LT000000"
              maxLength={25}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="vin-search-status"
            />
            {state.status !== "idle" && (
              <button
                type="button"
                className="vin-search-clear"
                onClick={() => {
                  setText("");
                  onClear();
                }}
                aria-label="Limpar busca pelo chassi"
              >
                <X size={14} />
              </button>
            )}
          </span>
        </label>
        <button type="submit" className="vin-search-submit" disabled={loading}>
          {loading ? <span className="spinner" /> : "Decodificar"}
        </button>
      </form>

      <div id="vin-search-status" aria-live="polite">
        {state.status === "error" && <p className="vin-search-error">{state.message}</p>}
        {state.status === "done" && <VinDetails state={state} applied={applied} />}
      </div>
    </section>
  );
}

function VinDetails({
  state,
  applied,
}: {
  state: Extract<VinSearchState, { status: "done" }>;
  applied: VinFilterResult | null;
}) {
  const { info, vpic, modelYear } = state.result;
  const vehicle = vpic === "error" ? null : vpic;
  const makers = [...new Set(info.makers.map((maker) => maker.m))];
  const engine = vehicle?.displacement ? `${vehicle.displacement.toFixed(1)} L` : undefined;

  return (
    <div className="vin-details">
      <dl>
        <div>
          <dt>Fabricante (WMI {info.wmi})</dt>
          <dd>{makers.length ? makers.join(" · ") : "Código não encontrado na lista"}</dd>
        </div>
        <div>
          <dt>País de fabricação</dt>
          <dd>{info.country ?? "Desconhecido"}</dd>
        </div>
        <div>
          <dt>Ano-modelo</dt>
          <dd>
            {modelYear ?? "Não identificado"}
            {modelYear !== null && (
              <small>
                {vehicle?.modelYear ? " (NHTSA)" : " (10º caractere; o código se repete a cada 30 anos)"}
              </small>
            )}
          </dd>
        </div>
        {vehicle && (
          <div>
            <dt>Modelo (NHTSA)</dt>
            <dd>
              {[vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")}
              <small>
                {[vehicle.bodyClass, vehicle.fuel, engine, vehicle.plant]
                  .filter(Boolean)
                  .map((part) => ` · ${part}`)
                  .join("")}
              </small>
            </dd>
          </div>
        )}
      </dl>
      <p className="vin-details-note">
        {vpic === "error"
          ? "A NHTSA (EUA) não respondeu; os dados acima vêm só da estrutura do chassi."
          : vehicle
            ? "Modelo e detalhes pela NHTSA (vPIC), que cobre veículos vendidos nos EUA."
            : "A NHTSA (EUA) não tem o modelo deste chassi, o que é comum em veículos fabricados no Brasil: confira a versão pelos filtros."}
        {!info.checkDigitValid && info.vin[0] >= "1" && info.vin[0] <= "5" && (
          <> O dígito verificador (9º caractere) não confere: revise o chassi digitado.</>
        )}
      </p>
      <p className="vin-details-applied">
        {applied?.filters
          ? `Filtros aplicados: ${[
              applied.brands.join(", "),
              applied.year !== null ? `ano ${applied.year}` : null,
              applied.model ? `“${applied.model}”` : null,
            ]
              .filter(Boolean)
              .join(" · ")}.`
          : "Este fabricante não tem marca no catálogo; nenhum filtro foi aplicado."}
      </p>
    </div>
  );
}
