import { Star, StarHalf, TrendingDown, TrendingUp } from "lucide-react";
import { formatFipePrice } from "../../catalog/indexFormat";
import { yearLabel } from "../../catalog/labels";
import type { CatalogEntry } from "../../catalog/types";
import { priceChange, toggleFavorite, useFavoriteIds, useFavorites } from "../../services/favorites";
import "./Favorite.css";

/**
 * Star that marks a version-year as favorite, remembering its price then.
 * Half filled when another of the version's years (`versionYears`) is one.
 */
export function FavoriteButton({
  entry,
  price,
  versionYears = [],
}: {
  entry: CatalogEntry;
  price: number | null;
  versionYears?: CatalogEntry[];
}) {
  const ids = useFavoriteIds();
  const active = ids.has(entry.id);
  const others = active ? [] : versionYears.filter((year) => year.id !== entry.id && ids.has(year.id));
  const label = `${entry.model} ${yearLabel(entry)}`;
  const elsewhere = others.length > 0 ? ` (${others.map(yearLabel).join(", ")} já está nos favoritos)` : "";
  return (
    <button
      type="button"
      className={`favorite-button${active ? " favorite-button-active" : others.length ? " favorite-button-other" : ""}`}
      aria-pressed={active}
      aria-label={active ? `Tirar ${label} dos favoritos` : `Favoritar ${label}${elsewhere}`}
      title={
        active
          ? "Tirar dos favoritos"
          : `Favoritar: acompanhe o preço na aba Favoritos${others.length ? `. Já nos favoritos: ${others.map(yearLabel).join(", ")}` : ""}`
      }
      onClick={() =>
        toggleFavorite({ id: entry.id, label, price, reference: price ? entry.referenceMonth : null })
      }
    >
      <span className="favorite-star" aria-hidden="true">
        <Star size={17} fill={active ? "currentColor" : "none"} />
        {others.length > 0 && <StarHalf size={17} fill="currentColor" className="favorite-star-half" />}
      </span>
    </button>
  );
}

/** The small star on a year pill that is a favorite. */
export function FavoriteMark() {
  return <Star size={10} fill="currentColor" className="favorite-mark" aria-hidden="true" />;
}

const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, signDisplay: "always" });
const savedDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** "Favoritado em 01/10/2026 por R$ 100.000,00 · +2,5% desde então", under the price. */
export function FavoriteNote({ entry, price }: { entry: CatalogEntry; price: number | null }) {
  const favorite = useFavorites().find((item) => item.id === entry.id);
  if (!favorite) return null;
  // Within the same FIPE month the price has not moved yet.
  const change = favorite.reference !== entry.referenceMonth ? priceChange(favorite, price) : null;
  const Trend = change && change.difference < 0 ? TrendingDown : TrendingUp;
  return (
    <p className="favorite-note">
      <Star size={12} fill="currentColor" aria-hidden="true" />
      Favoritado em {savedDate.format(new Date(favorite.savedAt))}
      {favorite.price ? ` por ${formatFipePrice(favorite.price)}` : ""}
      {change && (
        <span
          className={`favorite-change${change.difference === 0 ? "" : change.difference > 0 ? " favorite-up" : " favorite-down"}`}
          title={`FIPE de ${favorite.reference} para ${entry.referenceMonth}`}
        >
          {change.difference !== 0 && <Trend size={12} aria-hidden="true" />}
          {percent.format(change.percent).replace("-", "−")}% ({change.difference >= 0 ? "+" : "−"}
          {formatFipePrice(Math.abs(change.difference))}) desde então
        </span>
      )}
    </p>
  );
}
