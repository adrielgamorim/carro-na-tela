import { Check } from "lucide-react";
import type { CatalogEntry } from "../../catalog/types";
import { useEquipment } from "../../hooks/useEquipment";
import "./EquipmentList.css";

/** The version's standard equipment, by group, from the carmaker's list. */
export function EquipmentList({ entry }: { entry: CatalogEntry }) {
  const list = useEquipment(entry.equipment);
  if (!list) return null;
  const count = list.groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section className="equipment-list" aria-labelledby="equipment-list-title">
      <div className="price-history-heading">
        <div>
          <h4 id="equipment-list-title">Equipamentos de série · {count} itens</h4>
          <p>
            <a href={list.page} target="_blank" rel="noreferrer">
              Lista de equipamentos da {list.source}
            </a>{" "}
            ({list.title}) · da versão como lançada; pode variar de um ano para outro
          </p>
        </div>
      </div>
      <div className="equipment-groups">
        {list.groups.map((group) => (
          <div key={group.name} className="equipment-group">
            <h5>{group.name}</h5>
            <ul>
              {group.items.map((item) => (
                <li key={item}>
                  <Check size={14} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
