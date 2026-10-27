import { useState } from "react";
import { Check, Plus, RefreshCw, Users } from "lucide-react";
import type { CatalogGroup } from "../../catalog/filters";
import { entryTags, yearLabel } from "../../catalog/labels";
import { fleetOfYear, formatFleetCount } from "../../catalog/fleet";
import type { CatalogFleetInfo } from "../../catalog/fleet";
import type { CatalogEntry } from "../../catalog/types";
import type { FipeVehicle } from "../../types/vehicle";
import { BrandIcon } from "../BrandIcon";
import "./CatalogCard.css";

export type LivePrice =
  | { status: "loading" }
  | { status: "ready"; vehicle: FipeVehicle }
  | { status: "error"; message: string };

interface CatalogCardProps {
  group: CatalogGroup;
  livePrice: (entry: CatalogEntry) => LivePrice | undefined;
  isCompared: (entry: CatalogEntry) => boolean;
  canCompare: (entry: CatalogEntry) => boolean;
  comparisonFull: boolean;
  onFetchPrice: (entry: CatalogEntry) => void;
  onToggleCompare: (entry: CatalogEntry) => void;
  onShowDetails: (entry: CatalogEntry) => void;
}

const maxYearPills = 6;

function PriceBlock({
  entry,
  live,
  onFetchPrice,
}: {
  entry: CatalogEntry;
  live: LivePrice | undefined;
  onFetchPrice: () => void;
}) {
  const label = `VALOR FIPE · ${yearLabel(entry)}`;

  if (entry.price) {
    return (
      <div className="catalog-card-price">
        <span>{label}</span>
        <strong>{entry.price}</strong>
      </div>
    );
  }
  if (live?.status === "ready") {
    return (
      <div className="catalog-card-price">
        <span>
          {label} · CONSULTADO AGORA
        </span>
        <strong>{live.vehicle.price}</strong>
      </div>
    );
  }

  return (
    <div className="catalog-card-price catalog-card-price-missing">
      <span>{label}</span>
      {live?.status === "loading" ? (
        <p>
          <span className="spinner" /> Consultando a FIPE...
        </p>
      ) : (
        <>
          <p>
            {live?.status === "error"
              ? live.message
              : "Preço ainda não catalogado para este ano."}
          </p>
          <button type="button" className="catalog-fetch-price" onClick={onFetchPrice}>
            <RefreshCw size={14} aria-hidden="true" />
            {live?.status === "error" ? "Tentar novamente" : "Consultar preço"}
          </button>
        </>
      )}
    </div>
  );
}

export function CatalogCard({
  group,
  livePrice,
  isCompared,
  canCompare,
  comparisonFull,
  onFetchPrice,
  onToggleCompare,
  onShowDetails,
}: CatalogCardProps) {
  const [selectedId, setSelectedId] = useState(group.entries[0].id);
  const [showAllYears, setShowAllYears] = useState(false);
  // The selected year may disappear when filters change; fall back to newest.
  const selected =
    group.entries.find((entry) => entry.id === selectedId) ?? group.entries[0];
  const compared = isCompared(selected);
  const comparable = canCompare(selected);
  const years = showAllYears
    ? group.entries
    : group.entries.slice(0, maxYearPills);
  const hiddenYears = group.entries.length - years.length;
  const compareTitle = !comparable
    ? "Consulte o preço para comparar"
    : comparisonFull && !compared
      ? "A comparação aceita até 4 veículos"
      : undefined;

  return (
    <article className="catalog-card">
      {selected.wikidata?.image && (
        <img
          className="catalog-card-photo"
          src={selected.wikidata.image.thumb}
          alt={`${selected.wikidata.label} (foto ilustrativa do modelo)`}
          title="Foto ilustrativa da linha do modelo (Wikimedia Commons)"
          loading="lazy"
          decoding="async"
        />
      )}
      <div className="catalog-card-top">
        <span className="catalog-card-icon" aria-hidden="true">
          <BrandIcon brand={selected.brand} category={selected.category} size={18} />
        </span>
        <div className="catalog-card-title">
          <span>
            {selected.brand} · {selected.family}
          </span>
          <h3>{selected.model}</h3>
          {selected.fleet && <FleetLine entry={selected} fleet={selected.fleet} />}
        </div>
      </div>

      <div
        className="catalog-years"
        role="group"
        aria-label={`Anos-modelo de ${selected.model}`}
      >
        {years.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`year-pill${entry.id === selected.id ? " year-pill-active" : ""}`}
            aria-pressed={entry.id === selected.id}
            onClick={() => setSelectedId(entry.id)}
          >
            {yearLabel(entry)}
          </button>
        ))}
        {hiddenYears > 0 && (
          <button
            type="button"
            className="year-pill year-pill-more"
            onClick={() => setShowAllYears(true)}
          >
            +{hiddenYears}
          </button>
        )}
      </div>

      <PriceBlock
        entry={selected}
        live={livePrice(selected)}
        onFetchPrice={() => onFetchPrice(selected)}
      />

      <ul className="catalog-tags" aria-label="Características">
        {entryTags(selected).map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>

      <div className="catalog-card-footer">
        <small>
          {selected.codeFipe ? `FIPE ${selected.codeFipe} · ` : ""}
          {selected.referenceMonth}
        </small>
        <button
          type="button"
          className="catalog-details"
          disabled={!comparable}
          title={comparable ? "Ficha, custos e histórico de preços" : "Consulte o preço para ver os detalhes"}
          onClick={() => onShowDetails(selected)}
        >
          Detalhes
        </button>
        <button
          type="button"
          className={`catalog-compare${compared ? " catalog-compare-active" : ""}`}
          aria-pressed={compared}
          disabled={!comparable || (comparisonFull && !compared)}
          title={compareTitle}
          onClick={() => onToggleCompare(selected)}
        >
          {compared ? <Check size={15} /> : <Plus size={15} />}
          {compared ? "Comparando" : "Comparar"}
        </button>
      </div>
    </article>
  );
}

function FleetLine({ entry, fleet }: { entry: CatalogEntry; fleet: CatalogFleetInfo }) {
  const ofYear = fleetOfYear(fleet, entry.modelYear);
  const title =
    `Veículos da linha ${fleet.line.family} em circulação no Brasil (Senatran, ${fleet.reference}), ` +
    `todas as versões e anos: ${fleet.line.total.toLocaleString("pt-BR")}` +
    (ofYear !== null ? `; fabricados em ${entry.modelYear}: ${ofYear.toLocaleString("pt-BR")}` : "") +
    `. Casamento pelo nome do modelo.`;
  return (
    <p className="catalog-card-fleet" title={title}>
      <Users size={12} aria-hidden="true" />
      {formatFleetCount(fleet.line.total)} na frota · {fleet.line.rank}º mais comum
    </p>
  );
}
