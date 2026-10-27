import { clearCatalogParams } from "../catalog/catalogParams";
import { clearConsultaParams, hasConsultaParams } from "./consultaUrl";

// The app's URL scheme, in one place. There are two views on the same page:
//
//   /?marca=Fiat&ano=2020-2020                                                Catálogo (home)
//   /?versao=<entry id>                                                       Página de uma versão do catálogo
//   /?view=consulta&marcaId=21&familia=ARGO&modeloId=11&anoId=2026-5#comparacao Consulta FIPE
//
// Links from before the catalog became the home still work: "?view=catalogo"
// opens the catalog, and a consultation without "view=" opens the Consulta.
//
// Each view keeps only its own parameters (catalog/catalogParams.ts and
// services/consultaUrl.ts list them), so one never lingers behind the other.
// The hash scrolls to a section of the view. Two views do not need a router
// library; one is worth adopting when real pages appear (one per brand, say).

export type View = "consulta" | "catalogo";

/** The view a query string opens: the catalog unless it is a consultation. */
export function readView(search: string): View {
  const params = new URLSearchParams(search);
  const view = params.get("view");
  if (view === "consulta" || view === "catalogo") return view;
  return hasConsultaParams(params) ? "consulta" : "catalogo";
}

/** The URL of a view from the current one, without the other view's parameters. */
export function viewUrl(href: string, view: View, anchor?: string): URL {
  const url = new URL(href);
  if (view === "catalogo") {
    url.searchParams.delete("view");
    // The catalog link leaves a version's page for the list.
    url.searchParams.delete("versao");
    clearConsultaParams(url.searchParams);
  } else {
    url.searchParams.set("view", "consulta");
    clearCatalogParams(url.searchParams);
  }
  url.hash = anchor ?? "";
  return url;
}
