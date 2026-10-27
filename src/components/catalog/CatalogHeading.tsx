import { CircleAlert, Database } from "lucide-react";
import type { CatalogIndex } from "../../catalog/types";
import "./CatalogHeading.css";

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

/** Title, the catalog's reference stamp and the notice while it is still partial. */
export function CatalogHeading({ index }: { index: CatalogIndex }) {
  const entries = index.entries;
  const snapshot = index.snapshots.find((item) => item.category === "cars");
  // FIPE lists brands that stopped selling long before the crawl's first
  // year (Gurgel, Lada…), so fewer brands than FIPE has is not a gap: only an
  // unfinished listing is.
  const partialListing = snapshot !== undefined && !snapshot.listingComplete;
  // "80 de 108 marcas" is progress while listing; afterwards it only confuses.
  const brandTotal = partialListing ? (snapshot?.availableBrands ?? null) : null;
  const partialPrices = snapshot !== undefined && snapshot.priced < snapshot.listed;
  const pricedShare = snapshot?.listed
    ? Math.round((100 * snapshot.priced) / snapshot.listed)
    : 0;

  return (
    <>
      <section className="page-heading" aria-labelledby="catalog-title">
        <div>
          <p className="eyebrow">
            <span>02</span> CATÁLOGO DE VEÍCULOS
          </p>
          <h1 id="catalog-title">
            Todos os modelos.
            <br />
            <em>Filtre do seu jeito.</em>
          </h1>
          <p className="heading-copy">
            Combine marca, ano, preço, propulsão e câmbio e compare versões lado a
            lado.
          </p>
        </div>
        {snapshot && (
          <div className="reference-stamp">
            <div className="reference-icon">
              <Database size={17} />
            </div>
            <div>
              <span className="stamp-label">BASE DO CATÁLOGO</span>
              <strong className="stamp-month">
                {capitalize(snapshot.referenceMonth ?? snapshot.reference)}
              </strong>
              <small className="stamp-detail">
                {snapshot.brands.length}
                {brandTotal !== null && ` de ${brandTotal}`}{" "}
                {snapshot.brands.length === 1 && brandTotal === null
                  ? "marca"
                  : "marcas"}{" "}
                · {entries.length} versões-ano
              </small>
            </div>
          </div>
        )}
      </section>

      {snapshot && (partialListing || partialPrices) && (
        <div className="catalog-notice" role="note">
          <CircleAlert size={17} aria-hidden="true" />
          <div>
            {partialListing && (
              <p>
                <strong>Catálogo em construção.</strong> Por enquanto ele cobre{" "}
                {snapshot.brands.length <= 8
                  ? snapshot.brands.join(", ")
                  : `${snapshot.brands.length} marcas`}
                . Novas marcas e anos entram a cada varredura da tabela FIPE.
              </p>
            )}
            {partialPrices && (
              <p>
                <strong>
                  Preços: {snapshot.priced.toLocaleString("pt-BR")} de{" "}
                  {snapshot.listed.toLocaleString("pt-BR")} versões-ano ({pricedShare}%).
                </strong>{" "}
                O filtro e a ordenação por preço consideram só as que já têm preço;
                nas demais, use “Consultar preço”.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
