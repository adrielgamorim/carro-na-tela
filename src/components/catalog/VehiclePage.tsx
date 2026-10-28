import { useEffect } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { categoryLabel } from "../../constants/categories";
import { entryTags, yearLabel } from "../../catalog/labels";
import type { CatalogEntry } from "../../catalog/types";
import type { VehicleEnrichmentState } from "../../hooks/useVehicleEnrichment";
import type { FipeVehicle } from "../../types/vehicle";
import { BrandIcon } from "../BrandIcon";
import { ShareLinkButton } from "../ShareLinkButton";
import { VehicleDetails } from "../VehicleDetails";
import { FleetLine, PriceBlock } from "./CatalogCard";
import { ModelGallery } from "./ModelGallery";
import { FavoriteButton, FavoriteNote } from "./Favorite";
import type { LivePrice, PageLink } from "./CatalogCard";
import "./CatalogCard.css";
import "./VehiclePage.css";

interface VehiclePageProps {
  entry: CatalogEntry;
  /** The same version in every model year, newest first. */
  years: CatalogEntry[];
  /** Crawled or live price; without one there is no sheet, cost or history yet. */
  vehicle: FipeVehicle | null;
  live: LivePrice | undefined;
  enrichment: VehicleEnrichmentState | undefined;
  compared: boolean;
  comparisonFull: boolean;
  backLink: PageLink;
  yearLink: (entry: CatalogEntry) => PageLink;
  onFetchPrice: () => void;
  onToggleCompare: () => void;
  onRetryEnrichment: () => void;
}

/** Everything the app knows about one catalog version, on a page of its own (?versao=<id>). */
export function VehiclePage({
  entry,
  years,
  vehicle,
  live,
  enrichment,
  compared,
  comparisonFull,
  backLink,
  yearLink,
  onFetchPrice,
  onToggleCompare,
  onRetryEnrichment,
}: VehiclePageProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${entry.model} ${yearLabel(entry)} | Carro na tela`;
    return () => {
      document.title = previous;
    };
  }, [entry]);

  return (
    <article className="vehicle-page" aria-labelledby="vehicle-page-title">
      <a className="vehicle-page-back" {...backLink}>
        <ArrowLeft size={15} aria-hidden="true" /> Catálogo
      </a>

      <header className="vehicle-page-hero">
        {/* A new year can be another generation: start from its first photo. */}
        <ModelGallery key={entry.id} entry={entry} />

        <div className="vehicle-page-summary">
          <div className="catalog-card-top">
            <span className="catalog-card-icon" aria-hidden="true">
              <BrandIcon brand={entry.brand} category={entry.category} size={30} />
            </span>
            <div className="catalog-card-title">
              <span>
                {entry.brand} · {entry.family}
              </span>
              <h1 id="vehicle-page-title">{entry.model}</h1>
              {entry.fleet && <FleetLine entry={entry} fleet={entry.fleet} />}
            </div>
            <FavoriteButton entry={entry} price={vehicle?.priceValue ?? entry.priceValue} />
          </div>

          <nav className="catalog-years" aria-label={`Anos-modelo de ${entry.model}`}>
            {years.map((item) => (
              <a
                key={item.id}
                className={`year-pill${item.id === entry.id ? " year-pill-active" : ""}`}
                aria-current={item.id === entry.id ? "page" : undefined}
                {...yearLink(item)}
              >
                {yearLabel(item)}
              </a>
            ))}
          </nav>

          <PriceBlock entry={entry} live={live} onFetchPrice={onFetchPrice} />
          <FavoriteNote entry={entry} price={vehicle?.priceValue ?? entry.priceValue} />

          <ul className="catalog-tags" aria-label="Características">
            {entryTags(entry).map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>

          <div className="vehicle-page-actions">
            <button
              type="button"
              className={`catalog-compare${compared ? " catalog-compare-active" : ""}`}
              aria-pressed={compared}
              disabled={!vehicle || (comparisonFull && !compared)}
              title={
                !vehicle
                  ? "Consulte o preço para comparar"
                  : comparisonFull && !compared
                    ? "A comparação aceita até 4 veículos"
                    : undefined
              }
              onClick={onToggleCompare}
            >
              {compared ? <Check size={15} /> : <Plus size={15} />}
              {compared ? "Comparando" : "Comparar"}
            </button>
            <ShareLinkButton label="Copiar link desta versão" />
          </div>
          <small className="vehicle-page-reference">
            {entry.codeFipe ? `FIPE ${entry.codeFipe} · ` : ""}
            {entry.referenceMonth}
          </small>
        </div>
      </header>

      {vehicle ? (
        <VehicleDetails
          id={`catalog-details-${vehicle.id.replaceAll(":", "-")}`}
          vehicle={vehicle}
          categoryLabel={categoryLabel(vehicle.category) ?? "Veículo"}
          enrichment={enrichment}
          onRetryEnrichment={onRetryEnrichment}
          showModelPhoto={!entry.wikidata?.image}
        />
      ) : (
        <p className="vehicle-page-empty">
          Consulte o preço deste ano-modelo para ver a ficha técnica, os custos e o histórico de preços.
        </p>
      )}
    </article>
  );
}
