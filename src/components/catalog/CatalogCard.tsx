import { useState } from "react";
import type { MouseEvent } from "react";
import { Check, Plus, RefreshCw, TrendingUp, Users } from "lucide-react";
import type { CatalogGroup } from "../../catalog/filters";
import { estimateIpva, formatIpva, ipvaNoteOf } from "../../catalog/costs";
import { entryTags, yearLabel } from "../../catalog/labels";
import { fleetOfYear, fleetReferenceMonth, fleetReferenceYear, formatFleetCount, salesTitle } from "../../catalog/fleet";
import type { CatalogSort } from "../../catalog/filters";
import type { CatalogFleetInfo } from "../../catalog/fleet";
import type { CatalogEntry } from "../../catalog/types";
import { useCostSettings } from "../../services/costSettings";
import type { FipeVehicle } from "../../types/vehicle";
import { BrandIcon } from "../BrandIcon";
import { FavoriteButton, FavoriteMark, FavoriteNote } from "./Favorite";
import { useFavoriteIds } from "../../services/favorites";
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
  /** Link to the version's page: plain click opens it here, ctrl/middle click in a new tab. */
  pageLink: (entry: CatalogEntry) => PageLink;
  /** Year selected at first (the favorited one); else the newest. */
  initialEntryId?: string;
  /** Under a sales sort, the fleet line shows the line's sales instead of its fleet. */
  sort?: CatalogSort;
}

export interface PageLink {
  href: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

const maxYearPills = 6;

/** Yearly IPVA estimate under the price, in the state chosen in the cost settings, at the category's rate. */
function IpvaLine({ priceValue, category }: { priceValue: number | null; category: CatalogEntry["category"] }) {
  const { uf } = useCostSettings();
  if (!priceValue) return null;
  return (
    <small className="catalog-card-ipva" title={ipvaNoteOf(category)}>
      IPVA ≈ {formatIpva(estimateIpva(priceValue, uf, category))} ({uf})
    </small>
  );
}

export function PriceBlock({
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
        <IpvaLine priceValue={entry.priceValue} category={entry.category} />
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
        <IpvaLine priceValue={live.vehicle.priceValue} category={entry.category} />
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
  pageLink,
  initialEntryId,
  sort,
}: CatalogCardProps) {
  const [selectedId, setSelectedId] = useState(initialEntryId ?? group.entries[0].id);
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
  const favoriteIds = useFavoriteIds();
  const hiddenFavorite = group.entries.slice(years.length).some((entry) => favoriteIds.has(entry.id));
  const compareTitle = !comparable
    ? "Consulte o preço para comparar"
    : comparisonFull && !compared
      ? "A comparação aceita até 4 veículos"
      : undefined;
  const link = pageLink(selected);
  const live = livePrice(selected);
  const price = selected.priceValue ?? (live?.status === "ready" ? live.vehicle.priceValue : null);

  return (
    <article className="catalog-card">
      {selected.wikidata?.image && (
        // The name below is the accessible link; the photo is a bigger target for the mouse.
        <a className="catalog-card-photo-link" {...link} tabIndex={-1} aria-hidden="true">
          <img
            className="catalog-card-photo"
            src={selected.wikidata.image.thumb}
            alt=""
            title="Foto ilustrativa do modelo (Wikimedia Commons)"
            loading="lazy"
            decoding="async"
          />
        </a>
      )}
      <div className="catalog-card-top">
        <span className="catalog-card-icon" aria-hidden="true">
          <BrandIcon brand={selected.brand} category={selected.category} size={30} />
        </span>
        <div className="catalog-card-title">
          <span>
            {selected.brand} · {selected.family}
          </span>
          <h3>
            <a className="catalog-card-link" {...link}>
              {selected.model}
            </a>
          </h3>
          {selected.fleet && <FleetLine entry={selected} fleet={selected.fleet} sort={sort} />}
        </div>
        <FavoriteButton entry={selected} price={price} versionYears={group.entries} />
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
            aria-label={favoriteIds.has(entry.id) ? `${yearLabel(entry)}, nos favoritos` : undefined}
            onClick={() => setSelectedId(entry.id)}
          >
            {yearLabel(entry)}
            {favoriteIds.has(entry.id) && <FavoriteMark />}
          </button>
        ))}
        {hiddenYears > 0 && (
          <button
            type="button"
            className="year-pill year-pill-more"
            onClick={() => setShowAllYears(true)}
          >
            +{hiddenYears}
            {hiddenFavorite && <FavoriteMark />}
          </button>
        )}
      </div>

      <PriceBlock
        entry={selected}
        live={live}
        onFetchPrice={() => onFetchPrice(selected)}
      />
      <FavoriteNote entry={selected} price={price} />

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
        <a
          className="catalog-details"
          {...link}
          title="Página da versão: ficha, custos e histórico de preços"
          aria-label={`Detalhes de ${selected.model} ${yearLabel(selected)}`}
        >
          Detalhes
        </a>
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

export function FleetLine({
  entry,
  fleet,
  sort,
}: {
  entry: CatalogEntry;
  fleet: CatalogFleetInfo;
  sort?: CatalogSort;
}) {
  const sales = fleet.line.sales;
  if (sort === "sales-year" || sort === "sales-month") {
    const inMonth = sort === "sales-month";
    const count = inMonth ? sales?.month : sales?.year;
    const rank = inMonth ? sales?.monthRank : sales?.yearRank;
    if (sales && count && rank) {
      const period = inMonth
        ? `em ${fleetReferenceMonth(fleet.reference)}`
        : `em ${fleetReferenceYear(fleet.reference)} (até ${fleetReferenceMonth(fleet.reference)})`;
      return (
        <p className="catalog-card-fleet" title={salesTitle(fleet)}>
          <TrendingUp size={12} aria-hidden="true" />
          {formatFleetCount(count)} emplacados {period} · {rank}º mais vendido
        </p>
      );
    }
  }
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
