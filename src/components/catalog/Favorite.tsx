import { Star, TrendingDown, TrendingUp } from "lucide-react";
import { formatFipePrice } from "../../catalog/indexFormat";
import { yearLabel } from "../../catalog/labels";
import type { CatalogEntry } from "../../catalog/types";
import { priceChange, toggleFavorite, useFavorites } from "../../services/favorites";
import "./Favorite.css";

/** Star that marks a version-year as favorite, remembering its price then. */
export function FavoriteButton({ entry, price }: { entry: CatalogEntry; price: number | null }) {
  const active = useFavorites().some((favorite) => favorite.id === entry.id);
  const label = `${entry.model} ${yearLabel(entry)}`;
  return (
    <button
      type="button"
      className={`favorite-button${active ? " favorite-button-active" : ""}`}
      aria-pressed={active}
      aria-label={active ? `Tirar ${label} dos favoritos` : `Favoritar ${label}`}
      title={active ? "Tirar dos favoritos" : "Favoritar: acompanhe o preço na aba Favoritos"}
      onClick={() =>
        toggleFavorite({ id: entry.id, label, price, reference: price ? entry.referenceMonth : null })
      }
    >
      <Star size={17} fill={active ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
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
