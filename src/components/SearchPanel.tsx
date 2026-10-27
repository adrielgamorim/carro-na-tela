import { ChevronDown, CircleAlert, X } from "lucide-react";
import { categories, categoryLabel } from "../constants/categories";
import type { CatalogStep, FipeCatalog } from "../hooks/useFipeCatalog";
import type { FipeCodeLookup } from "../hooks/useFipeCodeLookup";
import { CategoryIcon } from "./CategoryIcon";
import { FipeCodeSearch } from "./FipeCodeSearch";
import { ShareLinkButton } from "./ShareLinkButton";
import "./SearchPanel.css";

const stepLabels: Record<CatalogStep, string> = {
  references: "a tabela de referência",
  brands: "as marcas",
  models: "os modelos",
  brandYears: "os anos da marca",
  years: "os anos do modelo",
  modelsForYear: "os modelos do ano",
  detail: "o valor do veículo",
};

/** Steps failing with the same message share one line ("os modelos e os anos…"). */
function groupErrors(errors: { step: CatalogStep; message: string }[]) {
  const groups = new Map<string, CatalogStep[]>();
  for (const { step, message } of errors) {
    groups.set(message, [...(groups.get(message) ?? []), step]);
  }
  return [...groups].map(([message, steps]) => ({ message, steps }));
}

function joinLabels(steps: CatalogStep[]): string {
  const labels = steps.map((step) => stepLabels[step]);
  return labels.length > 1
    ? `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`
    : (labels[0] ?? "");
}

interface SearchPanelProps {
  catalog: FipeCatalog;
  codeLookup: FipeCodeLookup;
}

export function SearchPanel({ catalog, codeLookup }: SearchPanelProps) {
  const {
    references,
    reference,
    category,
    brands,
    brand,
    modelFamilies,
    modelFamily,
    exactModels,
    model,
    availableYears,
    year,
    yearSelectionStarted,
    loadingReferences,
    loadingBrands,
    loadingModels,
    loadingYears,
    loadingBrandYears,
    loadingModelsForYear,
    loadingDetail,
    errors,
  } = catalog;

  return (
    <section
      className="search-panel"
      id="pesquisa"
      aria-labelledby="search-title"
    >
      <div className="section-heading">
        <div className="step-number">01</div>
        <div>
          <h2 id="search-title">Encontre seu veículo</h2>
          <p>Escolha uma categoria e avance pelo catálogo FIPE.</p>
        </div>
        <div className="api-status">
          <span className="live-dot" /> CONSULTA ONLINE
        </div>
      </div>
      <div className="search-controls">
        <div
          className="category-control"
          role="group"
          aria-label="Categoria do veículo"
        >
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`category-option${category === item.id ? " category-option-active" : ""}`}
              aria-pressed={category === item.id}
              onClick={() => catalog.changeCategory(item.id)}
            >
              <CategoryIcon category={item.id} size={17} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="select-grid">
          <label className="field-group">
            <span className="field-label">Referência</span>
            <span className="select-wrap">
              <select
                value={reference}
                onChange={(event) => catalog.changeReference(event.target.value)}
                disabled={loadingReferences || references.length === 0}
                aria-label="Mês de referência FIPE"
              >
                <option value="">
                  {loadingReferences ? "Carregando..." : "Selecione"}
                </option>
                {references.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.month}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </label>
          <label className="field-group">
            <span className="field-label">Marca</span>
            <span className="select-wrap">
              <select
                value={brand}
                onChange={(event) => catalog.changeBrand(event.target.value)}
                disabled={!reference || loadingBrands}
              >
                <option value="">
                  {loadingBrands ? "Carregando marcas..." : "Selecione a marca"}
                </option>
                {brands.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </label>
          <label className="field-group">
            <span className="field-label">Linha / família</span>
            <span className="select-wrap">
              <select
                value={modelFamily}
                onChange={(event) =>
                  catalog.changeModelFamily(event.target.value)
                }
                disabled={!brand || loadingModels}
              >
                <option value="">
                  {loadingModels ? "Carregando linhas..." : "Selecione a linha"}
                </option>
                {modelFamilies.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </label>
          <label className="field-group">
            <span className="field-label">Modelo exato</span>
            <span className="select-wrap">
              <select
                value={model}
                onChange={(event) => catalog.changeModel(event.target.value)}
                disabled={!modelFamily || loadingModels || loadingModelsForYear}
              >
                <option value="">
                  {loadingModelsForYear
                    ? "Buscando modelos para o ano..."
                    : loadingModels
                      ? "Carregando modelos..."
                      : modelFamily &&
                          yearSelectionStarted &&
                          exactModels.length === 0
                        ? "Nenhum modelo disponível neste ano"
                        : "Selecione o modelo"}
                </option>
                {exactModels.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </label>
          <label className="field-group">
            <span className="field-label">Ano / versão</span>
            <span className="select-wrap">
              <select
                value={year}
                onChange={(event) => catalog.changeYear(event.target.value)}
                disabled={
                  !modelFamily ||
                  loadingBrandYears ||
                  loadingModelsForYear ||
                  (Boolean(model) && !yearSelectionStarted && loadingYears) ||
                  loadingDetail
                }
              >
                <option value="">
                  {loadingBrandYears || loadingYears
                    ? "Carregando anos..."
                    : "Selecione o ano"}
                </option>
                {availableYears.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </label>
        </div>
        <FipeCodeSearch
          lookup={codeLookup}
          category={category}
          disabled={!reference}
        />
        {errors.length > 0 && (
          <div className="request-error" role="alert">
            <CircleAlert size={18} />
            <span>
              {groupErrors(errors).map(({ steps, message }) => (
                <span key={message} className="request-error-line">
                  Não foi possível carregar {joinLabels(steps)}. {message}
                </span>
              ))}
            </span>
            <button type="button" onClick={catalog.retry}>
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={catalog.dismissError}
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="search-footnote">
          <span>
            <span className="footnote-mark">i</span> Valor de referência, não
            preço de anúncio.
          </span>
          <ShareLinkButton />
          <span>
            {loadingDetail ? (
              <>
                <span className="spinner" /> Consultando valor...
              </>
            ) : (
              `Catálogo ${categoryLabel(category)?.toLocaleLowerCase("pt-BR")}`
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
