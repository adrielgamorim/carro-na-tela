import { useState } from "react";
import { ChevronDown, Hash, X } from "lucide-react";
import { categoryLabel } from "../constants/categories";
import type { FipeCodeLookup } from "../hooks/useFipeCodeLookup";
import type { VehicleCategory } from "../types/vehicle";
import "./FipeCodeSearch.css";

interface FipeCodeSearchProps {
  lookup: FipeCodeLookup;
  /** Selected vehicle type, tried first. */
  category: VehicleCategory;
  disabled: boolean;
}

export function FipeCodeSearch({ lookup, category, disabled }: FipeCodeSearchProps) {
  const [text, setText] = useState(lookup.code);
  const loading = lookup.status === "loading";
  const showYears = lookup.years.length > 1 && lookup.status !== "error";

  return (
    <form
      className="fipe-code-search"
      onSubmit={(event) => {
        event.preventDefault();
        lookup.submit(text, category);
      }}
    >
      <label className="field-group fipe-code-field">
        <span className="field-label">Ou busque pelo código FIPE</span>
        <span className="fipe-code-input">
          <Hash size={14} aria-hidden="true" />
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ex.: 001580-1"
            inputMode="numeric"
            autoComplete="off"
            aria-describedby="fipe-code-status"
          />
          {lookup.code && (
            <button
              type="button"
              className="fipe-code-clear"
              onClick={() => {
                setText("");
                lookup.clear();
              }}
              aria-label="Limpar busca por código"
            >
              <X size={14} />
            </button>
          )}
        </span>
      </label>
      {showYears && (
        <label className="field-group fipe-code-year">
          <span className="field-label">
            Ano / versão
            {lookup.category ? ` · ${categoryLabel(lookup.category)}` : ""}
          </span>
          <span className="select-wrap">
            <select
              value={lookup.year}
              onChange={(event) => lookup.chooseYear(event.target.value)}
              disabled={loading}
            >
              <option value="">Selecione o ano</option>
              {lookup.years.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </span>
        </label>
      )}
      <button type="submit" className="fipe-code-submit" disabled={disabled || loading}>
        {loading ? <span className="spinner" /> : "Buscar"}
      </button>
      <p id="fipe-code-status" className="fipe-code-status" aria-live="polite">
        {lookup.status === "error" && <span className="fipe-code-error">{lookup.error}</span>}
        {lookup.status === "loaded" && "Veículo adicionado às consultas abaixo."}
      </p>
    </form>
  );
}
