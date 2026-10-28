import {
  bodyLabels,
  formatKmL,
  propulsionLabels,
  sizeLabels,
  steeringLabels,
  transmissionLabels,
} from "../catalog/labels";
import { costPerKm, estimateIpva, formatIpva, formatPerKm } from "../catalog/costs";
import { formatSpec, isWikidataItem, specLabels, wikidataUrl } from "../catalog/wikidata";
import type { CatalogFleetInfo } from "../catalog/fleet";
import { fleetOfYear, fleetOrigin } from "../catalog/fleet";
import { formatDepreciation } from "../catalog/depreciation";
import type { CatalogModelInfo } from "../catalog/wikidata";
import { formatTorque, formatTrunk, releaseMonth } from "../catalog/press";
import type { PressSpecs } from "../catalog/press";
import type { VehicleEnrichmentState } from "../hooks/useVehicleEnrichment";
import { useCostSettings } from "../services/costSettings";
import { formatModelYear } from "../services/fipeParsing";
import type { CostSettings } from "../services/costSettings";
import { CostSettingsPanel } from "./CostSettingsPanel";
import { PriceSparkline } from "./PriceSparkline";
import type { EnrichmentKey } from "../services/enrichment";
import type { FipeVehicle } from "../types/vehicle";
import "./VehicleDetails.css";

interface VehicleDetailsProps {
  id: string;
  vehicle: FipeVehicle;
  categoryLabel: string;
  enrichment: VehicleEnrichmentState | undefined;
  onRetryEnrichment: () => void;
  /** False where the page already shows the model's photo (the catalog's version page). */
  showModelPhoto?: boolean;
}

const providerLabels: Record<EnrichmentKey, string> = {
  history: "o histórico de preços",
  specs: "a ficha do nome FIPE",
  inmetro: "os dados do INMETRO",
  model: "a descrição do modelo",
  fleet: "a frota da Senatran",
  depreciation: "a depreciação",
  press: "os dados dos releases",
};

/** Links to the press releases the trunk and torque came from. */
function PressSources({ press }: { press: PressSpecs }) {
  const sources = [press.trunk?.source, press.torque?.source].filter(
    (source, index, all): source is NonNullable<typeof source> =>
      source !== undefined && all.findIndex((other) => other?.url === source.url) === index,
  );
  return (
    <>
      {" · porta-malas e torque da linha, em "}
      {sources.map((source, index) => (
        <span key={source.url}>
          {index > 0 && " e "}
          <a href={source.url} target="_blank" rel="noreferrer" title={source.title}>
            release da Stellantis ({releaseMonth(source.date)})
          </a>
        </span>
      ))}
    </>
  );
}

/** Picture and summary of the model line (Wikidata / Wikipedia / Commons). */
function ModelInfo({ model, showPhoto }: { model: CatalogModelInfo; showPhoto: boolean }) {
  const credit = [model.image?.artist, model.image?.license].filter(Boolean).join(", ");
  return (
    <section className="price-history model-info" aria-label={`Sobre o modelo ${model.label}`}>
      <div className="price-history-heading">
        <div>
          <h4>Sobre o modelo · {model.label}</h4>
          <p>
            {isWikidataItem(model.id) ? "Wikipedia e Wikidata" : model.wikipedia ? "Wikipedia" : "Wikimedia Commons"}{" "}
            · linha do modelo, não esta versão exata
          </p>
        </div>
      </div>
      <div className="model-info-body">
        {showPhoto && model.image && (
          <figure>
            <img src={model.image.thumb} alt={`${model.label} (foto ilustrativa)`} loading="lazy" />
            <figcaption>
              <a href={model.image.page} target="_blank" rel="noreferrer">
                {credit ? `Foto: ${credit}` : "Foto"} · Wikimedia Commons
              </a>
            </figcaption>
          </figure>
        )}
        <div>
          {model.description && <p>{model.description}</p>}
          <p className="model-info-links">
            {model.wikipedia && (
              <a href={model.wikipedia} target="_blank" rel="noreferrer">
                Wikipedia
              </a>
            )}
            {isWikidataItem(model.id) && (
              <a href={wikidataUrl(model.id)} target="_blank" rel="noreferrer">
                Wikidata
              </a>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Vehicles of the model line in circulation (Senatran, matched by name). */
function FleetDetail({
  fleet,
  modelYear,
  uf,
}: {
  fleet: CatalogFleetInfo;
  modelYear: number;
  /** State chosen in the cost settings. */
  uf: string;
}) {
  // FIPE writes 0 km as model year 32000.
  const ofYear = fleetOfYear(fleet, modelYear < 3000 ? modelYear : null);
  const inState = fleet.line.states?.[uf];
  return (
    <div
      className="vehicle-detail-wide"
      title={`Senatran (Renavam), ${fleet.reference}. Casamento pelo nome da linha do modelo; o Renavam conta o ano de fabricação.`}
    >
      <dt>Frota em circulação · {fleet.line.family}</dt>
      <dd>
        {fleet.line.total.toLocaleString("pt-BR")} veículos · {fleet.line.rank}º de {fleet.lineCount} linhas
        {fleetOrigin(fleet.line) === "importado" && " · importado"}
        {ofYear !== null && (
          <small>
            {" "}
            · {ofYear.toLocaleString("pt-BR")} fabricados em {modelYear}
          </small>
        )}
        {inState && (
          <>
            <br />
            Em {uf}: {inState[0].toLocaleString("pt-BR")} veículos · {inState[1]}º mais comum
          </>
        )}
      </dd>
    </div>
  );
}

/** Technical sheet rows from the FIPE name and the INMETRO table. */
function specRows(
  enrichment: VehicleEnrichmentState | undefined,
  vehicle: FipeVehicle,
  settings: CostSettings,
) {
  const specs = enrichment?.data.specs?.data;
  const inmetro = enrichment?.data.inmetro?.data;
  const consumption = inmetro?.consumption;
  const engine = [
    specs?.engineLiters?.toFixed(1),
    specs?.valves ? `${specs.valves}V` : undefined,
    specs?.aspiration === "turbo" ? "turbo" : undefined,
    specs?.aspiration === "compressor" ? "compressor" : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const transmission = inmetro?.transmission ?? specs?.transmission;
  const body = specs?.bodyHint ?? inmetro?.body;
  const press = enrichment?.data.press?.data;
  const km = (value: number | null | undefined) =>
    value === null || value === undefined ? null : formatKmL(value);

  const rows: [string, string | null][] = [
    ["Motor", engine || inmetro?.engine || null],
    // Exact from the FIPE name; else the model line's range (≈).
    [
      "Potência",
      specs?.powerCv
        ? `${specs.powerCv} cv`
        : enrichment?.data.model?.data.specs?.power
          ? formatSpec("power", enrichment.data.model.data.specs.power)
          : null,
    ],
    ["Torque", press?.torque ? formatTorque(press.torque.value) : null],
    ["Propulsão", inmetro ? propulsionLabels[inmetro.propulsion] : null],
    [
      "Câmbio",
      transmission
        ? `${transmissionLabels[transmission]}${inmetro?.gears ? `, ${inmetro.gears} marchas` : ""}`
        : null,
    ],
    ["Configuração", body ? bodyLabels[body] : null],
    ["Porte", inmetro?.size ? sizeLabels[inmetro.size] : null],
    ["Portas", specs?.doors ? String(specs.doors) : null],
    ["Porta-malas", press?.trunk ? formatTrunk(press.trunk.value) : null],
    ["Consumo na cidade", km(consumption?.fuelCity ?? consumption?.electricCity)],
    ["Consumo na estrada", km(consumption?.fuelHighway ?? consumption?.electricHighway)],
    ["Etanol na cidade", km(consumption?.ethanolCity)],
    ["Etanol na estrada", km(consumption?.ethanolHighway)],
    ["Autonomia elétrica", inmetro?.rangeKm ? `${inmetro.rangeKm} km` : null],
    ["Direção", inmetro?.steering ? steeringLabels[inmetro.steering] : null],
    [
      "Ar-condicionado",
      inmetro?.airConditioning === true ? "Sim" : inmetro?.airConditioning === false ? "Não" : null,
    ],
  ];
  // Size and mass of the model line (Wikidata), approximate for this version.
  const modelSpecs = enrichment?.data.model?.data.specs;
  for (const [key, label] of specLabels) {
    const range = modelSpecs?.[key];
    if (range) rows.push([label, formatSpec(key, range)]);
  }
  // IPVA rates are for passenger cars; motorcycles and trucks pay other rates.
  if (vehicle.category === "cars" && vehicle.priceValue > 0) {
    rows.push([
      `IPVA estimado (${settings.uf})`,
      formatIpva(estimateIpva(vehicle.priceValue, settings.uf)),
    ]);
  }
  const cost = costPerKm(inmetro, settings.prices);
  if (cost) {
    rows.push(["Custo por km (uso misto)", cost.options.map(formatPerKm).join(" · ")]);
  }
  return rows.filter((row): row is [string, string] => row[1] !== null);
}

export function VehicleDetails({
  id,
  vehicle,
  categoryLabel,
  enrichment,
  onRetryEnrichment,
  showModelPhoto = true,
}: VehicleDetailsProps) {
  const loading = enrichment?.status === "loading";
  const history = enrichment?.data.history?.data ?? [];
  const inmetro = enrichment?.data.inmetro;
  const model = enrichment?.data.model?.data;
  const fleet = enrichment?.data.fleet?.data;
  const depreciation = enrichment?.data.depreciation?.data;
  const errors = Object.entries(enrichment?.errors ?? {}) as [EnrichmentKey, string][];
  const settings = useCostSettings();
  const sheet = specRows(enrichment, vehicle, settings);

  return (
    <div className="vehicle-details" id={id}>
      <dl className="vehicle-detail-grid">
        <div>
          <dt>Categoria</dt>
          <dd>{categoryLabel}</dd>
        </div>
        <div>
          <dt>Ano-modelo</dt>
          <dd>{formatModelYear(vehicle.modelYear)}</dd>
        </div>
        <div>
          <dt>Combustível</dt>
          <dd>
            {vehicle.fuel} ({vehicle.fuelAcronym})
          </dd>
        </div>
        <div>
          <dt>Código ano/combustível</dt>
          <dd>{vehicle.yearCode}</dd>
        </div>
        <div>
          <dt>Código FIPE</dt>
          <dd>{vehicle.codeFipe}</dd>
        </div>
        {fleet && <FleetDetail fleet={fleet} modelYear={vehicle.modelYear} uf={settings.uf} />}
        {depreciation && (
          <div
            className="vehicle-detail-wide"
            title="Comparação dos preços FIPE desta versão em anos-modelo diferentes, no mesmo mês de referência."
          >
            <dt>Depreciação média desta versão</dt>
            <dd>{formatDepreciation(depreciation)}</dd>
          </div>
        )}
        <div>
          <dt>Referência</dt>
          <dd>{vehicle.referenceMonth}</dd>
        </div>
        <div>
          <dt>Valor de referência</dt>
          <dd>{vehicle.price}</dd>
        </div>
      </dl>

      {errors.length > 0 && (
        <div className="history-message history-error" role="alert">
          <span>
            {errors.map(([key, message]) => (
              <span key={key} className="request-error-line">
                Não foi possível carregar {providerLabels[key]}. {message}
              </span>
            ))}
          </span>
          <button type="button" onClick={onRetryEnrichment}>
            Tentar novamente
          </button>
        </div>
      )}

      {model && <ModelInfo model={model} showPhoto={showModelPhoto} />}

      {sheet.length > 0 && (
        <section className="price-history" aria-label={`Ficha técnica de ${vehicle.model}`}>
          <div className="price-history-heading">
            <div>
              <h4>Ficha técnica</h4>
              <p>
                {inmetro
                  ? `INMETRO ${inmetro.data.table} · ${
                      inmetro.confidence === "exact" ? "versão exata" : "versão aproximada"
                    } · demais dados do nome FIPE`
                  : "Extraída do nome FIPE; sem dados do INMETRO para esta versão"}
                {model?.specs && " · ≈ medidas, peso e potência da linha do modelo (Wikidata e Wikipedia)"}
                {enrichment?.data.press && <PressSources press={enrichment.data.press.data} />}
              </p>
            </div>
          </div>
          <dl className="vehicle-detail-grid vehicle-spec-grid">
            {sheet.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <CostSettingsPanel />
        </section>
      )}

      <section
        className="price-history"
        aria-label={`Histórico FIPE de ${vehicle.model}`}
      >
        <div className="price-history-heading">
          <div>
            <h4>Histórico de preços</h4>
            <p>Valores por mês de referência FIPE</p>
          </div>
          {loading && (
            <span className="history-loading">
              <span className="spinner" /> Carregando dados
            </span>
          )}
        </div>
        {!loading && !enrichment?.errors.history && history.length === 0 && (
          <p className="history-message">
            Histórico indisponível para esta consulta.
          </p>
        )}
        <PriceSparkline history={history} />
        {history.length > 0 && (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Valor FIPE</th>
                  <th>Referência</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.reference}>
                    <td>{item.month}</td>
                    <td>{item.price}</td>
                    <td>{item.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
