import { useState } from "react";
import { Search } from "lucide-react";
import type { FacetOption } from "../../catalog/filters";
import type { Labeler } from "./facetValues";
import "./facetControls.css";

// Building blocks of the catalog filter panel: a checkbox list (with a search
// box for long lists), a chip group, and the helpers they share.

export interface FacetProps {
  options: FacetOption[];
  selected: string[];
  label: Labeler;
  onToggle: (value: string) => void;
}

// Lists longer than this get a search box.
const searchableFrom = 10;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export function CheckList({
  options,
  selected,
  label,
  onToggle,
  hideEmpty = false,
  searchLabel,
}: FacetProps & { hideEmpty?: boolean; searchLabel: string }) {
  const [search, setSearch] = useState("");
  const available = hideEmpty
    ? options.filter(
        (option) => option.count > 0 || selected.includes(option.value),
      )
    : options;
  const term = normalize(search.trim());
  // Selected options stay visible so they can be unchecked while searching.
  const visible = term
    ? available.filter(
        (option) =>
          selected.includes(option.value) ||
          normalize(label(option.value)).includes(term),
      )
    : available;

  if (available.length === 0) {
    return <p className="facet-empty">Nenhuma opção para os filtros atuais.</p>;
  }

  return (
    <>
      {available.length > searchableFrom && (
        <label className="facet-search">
          <Search size={13} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
          />
        </label>
      )}
      {visible.length === 0 ? (
        <p className="facet-empty">Nada encontrado para “{search.trim()}”.</p>
      ) : (
        <CheckListItems
          options={visible}
          selected={selected}
          label={label}
          onToggle={onToggle}
        />
      )}
    </>
  );
}

function CheckListItems({ options: visible, selected, label, onToggle }: FacetProps) {
  return (
    <ul className="facet-checklist">
      {visible.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <li key={option.value}>
            <label
              className={`facet-check${option.count === 0 && !checked ? " facet-disabled" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={option.count === 0 && !checked}
                onChange={() => onToggle(option.value)}
              />
              <span>{label(option.value)}</span>
              <small>{option.count}</small>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function ChipGroup({ options, selected, label, onToggle }: FacetProps) {
  if (options.length === 0) {
    return <p className="facet-empty">Sem dados para este filtro ainda.</p>;
  }

  return (
    <div className="facet-chips">
      {options.map((option) => {
        const pressed = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={`facet-chip${pressed ? " facet-chip-active" : ""}`}
            aria-pressed={pressed}
            disabled={option.count === 0 && !pressed}
            onClick={() => onToggle(option.value)}
          >
            {label(option.value)} <small>{option.count}</small>
          </button>
        );
      })}
    </div>
  );
}
