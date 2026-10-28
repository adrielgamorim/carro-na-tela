import { useMemo } from "react";
import { GitCompareArrows, Star, X } from "lucide-react";
import { groupCatalog } from "../../catalog/filters";
import type { CatalogGroup } from "../../catalog/filters";
import type { CatalogEntry } from "../../catalog/types";
import { removeFavorite } from "../../services/favorites";
import type { Favorite } from "../../services/favorites";
import { CatalogCard } from "./CatalogCard";
import type { LivePrice, PageLink } from "./CatalogCard";
import "./FavoritesList.css";

interface FavoritesListProps {
  favorites: Favorite[];
  entries: CatalogEntry[];
  livePrice: (entry: CatalogEntry) => LivePrice | undefined;
  isCompared: (entry: CatalogEntry) => boolean;
  canCompare: (entry: CatalogEntry) => boolean;
  comparisonFull: boolean;
  onFetchPrice: (entry: CatalogEntry) => void;
  onToggleCompare: (entry: CatalogEntry) => void;
  /** Adds the favorites (up to the comparison's limit) and opens the table. */
  onCompareAll: (entries: CatalogEntry[]) => void;
  onOpenCatalog: () => void;
  pageLink: (entry: CatalogEntry) => PageLink;
}

const versionKey = (entry: CatalogEntry) => `${entry.category}:${entry.brandCode}:${entry.modelCode}`;

/** The versions marked as favorite, newest first, each on its catalog card at the marked year. */
export function FavoritesList({ favorites, entries, onCompareAll, onOpenCatalog, ...card }: FavoritesListProps) {
  // Every year of each version, so the card can switch years like in the catalog.
  const versions = useMemo(() => {
    const byVersion = new Map<string, CatalogEntry[]>();
    for (const entry of entries) {
      const key = versionKey(entry);
      const list = byVersion.get(key);
      if (list) list.push(entry);
      else byVersion.set(key, [entry]);
    }
    return byVersion;
  }, [entries]);
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);

  const found: { favorite: Favorite; entry: CatalogEntry; group: CatalogGroup }[] = [];
  const missing: Favorite[] = [];
  for (const favorite of favorites) {
    const entry = entryById.get(favorite.id);
    const group = entry && groupCatalog(versions.get(versionKey(entry)) ?? [entry], "newest")[0];
    if (entry && group) found.push({ favorite, entry, group });
    else missing.push(favorite);
  }
  const comparable = found.map(({ entry }) => entry).filter(card.canCompare);

  return (
    <section className="favorites" aria-labelledby="favorites-title">
      <div className="favorites-heading">
        <div>
          <h2 id="favorites-title">
            <Star size={18} fill="currentColor" aria-hidden="true" /> Favoritos
            <span>{favorites.length}</span>
          </h2>
          <p>
            O preço de quando você favoritou fica guardado, para ver quanto a FIPE mudou desde então. Os
            favoritos ficam neste navegador.
          </p>
        </div>
        {comparable.length > 1 && (
          <button type="button" className="favorites-compare" onClick={() => onCompareAll(comparable)}>
            <GitCompareArrows size={16} aria-hidden="true" />
            Comparar {Math.min(comparable.length, 4)} favoritos
          </button>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="empty-results">
          <div className="empty-icon">
            <Star size={22} />
          </div>
          <strong>Nenhum favorito ainda</strong>
          <p>Toque na estrela de um carro no catálogo para acompanhar o preço dele aqui.</p>
          <button type="button" className="link-button" onClick={onOpenCatalog}>
            Ir para o catálogo
          </button>
        </div>
      ) : (
        <div className="catalog-grid">
          {found.map(({ favorite, group }) => (
            <CatalogCard key={favorite.id} group={group} initialEntryId={favorite.id} {...card} />
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <div className="favorites-missing">
          <strong>Fora do catálogo atual</strong>
          <p>Estas versões não estão mais no índice da FIPE (ou ainda não foram carregadas):</p>
          <ul>
            {missing.map((favorite) => (
              <li key={favorite.id}>
                {favorite.label}
                <button
                  type="button"
                  onClick={() => removeFavorite(favorite.id)}
                  aria-label={`Tirar ${favorite.label} dos favoritos`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
