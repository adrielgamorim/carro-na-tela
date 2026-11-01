import { categories } from "../../constants/categories";
import type { CatalogEntry } from "../../catalog/types";
import type { VehicleCategory } from "../../types/vehicle";
import { CategoryIcon } from "../CategoryIcon";
import "../SearchPanel.css";
import "./CategoryTabs.css";

interface CategoryTabsProps {
  entries: CatalogEntry[];
  category: VehicleCategory;
  onChange: (category: VehicleCategory) => void;
}

/** Cars, motorcycles or trucks, like the Consulta FIPE's; only those the catalog has, and none when it has cars alone. */
export function CategoryTabs({ entries, category, onChange }: CategoryTabsProps) {
  const present = new Set(entries.map((entry) => entry.category));
  const shown = categories.filter((item) => present.has(item.id));
  if (shown.length < 2) return null;
  return (
    <div className="category-control catalog-category-tabs" role="group" aria-label="Categoria do veículo">
      {shown.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`category-option${category === item.id ? " category-option-active" : ""}`}
          aria-pressed={category === item.id}
          onClick={() => onChange(item.id)}
        >
          <CategoryIcon category={item.id} size={17} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
