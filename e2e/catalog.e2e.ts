import { expect, test } from "./fixtures.ts";

test("searches the motorcycles and opens a version's page", async ({ page }) => {
  await page.goto("/?aba=catalogo");
  await page.getByRole("button", { name: "Motos" }).click();
  await expect(page).toHaveURL(/categoria=motorcycles/);
  await page.getByRole("searchbox", { name: "Buscar no catálogo" }).fill("africa twin");

  const card = page.getByRole("link", { name: "CRF 1000L AFRICA TWIN", exact: true });
  await expect(card).toBeVisible();
  await card.click();

  await expect(page).toHaveURL(/versao=/);
  await expect(page.getByRole("heading", { level: 1, name: "CRF 1000L AFRICA TWIN" })).toBeVisible();
  await expect(page.getByText("Valor FIPE", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/IPVA ≈ R\$/).first()).toBeVisible();
  await expect(page.getByText(/Honda CRF1000L Africa Twin/).first()).toBeVisible();

  // Back to the catalog, with the search kept.
  await page.getByRole("link", { name: "Catálogo" }).first().click();
  await expect(page.getByRole("searchbox", { name: "Buscar no catálogo" })).toHaveValue("africa twin");
});

test("opens a version straight from its link", async ({ page }) => {
  await page.goto("/?aba=catalogo&categoria=motorcycles&q=africa+twin");
  const href = await page.getByRole("link", { name: "CRF 1000L AFRICA TWIN", exact: true }).getAttribute("href");
  await page.goto(href!);
  await expect(page.getByRole("heading", { level: 1, name: "CRF 1000L AFRICA TWIN" })).toBeVisible();
  await expect(page).toHaveTitle(/CRF 1000L AFRICA TWIN/);
});

test("compares two versions side by side", async ({ page }) => {
  await page.goto("/?aba=catalogo&q=onix+plus");
  const compare = page.getByRole("button", { name: "Comparar", exact: true });
  await expect(compare.nth(1)).toBeVisible();
  await compare.nth(0).click();
  await compare.nth(1).click();

  const tray = page.getByRole("region", { name: "Veículos para comparar" });
  await expect(tray.getByRole("listitem")).toHaveCount(2);
  await tray.getByRole("button", { name: /Comparar 2\/4/ }).click();

  const table = page.getByRole("heading", { name: "Comparação lado a lado" });
  await expect(table).toBeVisible();
  await page.getByRole("button", { name: "Fechar comparação" }).click();
  await expect(table).toBeHidden();

  // Removing one from the tray leaves the other.
  await tray.getByRole("button", { name: /^Remover .* da comparação$/ }).first().click();
  await expect(tray.getByRole("listitem")).toHaveCount(1);
});

test("keeps a favorite after a reload", async ({ page }) => {
  await page.goto("/?aba=catalogo&q=onix+plus");
  const star = page.getByRole("button", { name: /^Favoritar / }).first();
  const label = (await star.getAttribute("aria-label"))!.replace(/^Favoritar /, "");
  await star.click();

  await page.goto("/?aba=catalogo&view=favoritos");
  await page.reload();
  const favorites = page.getByRole("region", { name: /Favoritos/ });
  await expect(favorites.getByRole("button", { name: `Tirar ${label} dos favoritos` })).toBeVisible();

  await favorites.getByRole("button", { name: `Tirar ${label} dos favoritos` }).click();
  await expect(favorites.getByText("Nenhum favorito ainda")).toBeVisible();
});

test("searches by text and clears the search chip", async ({ page }) => {
  await page.goto("/?aba=catalogo");
  await page.getByRole("searchbox", { name: "Buscar no catálogo" }).fill("hilux");
  const chip = page.getByRole("button", { name: "Remover filtro “hilux”" });
  await expect(chip).toBeVisible();
  await expect(page.getByRole("link", { name: /^Hilux /i }).first()).toBeVisible();
  await chip.click();
  await expect(page.getByRole("searchbox", { name: "Buscar no catálogo" })).toHaveValue("");
});

test("decodes a VIN from the local WMI table", async ({ page }) => {
  await page.goto("/?aba=catalogo");
  await page.getByPlaceholder("Ex.: 9BWAB45U0LT000000").fill("9BWAB45U0LT000000");
  await page.getByRole("button", { name: "Decodificar" }).click();
  // 9BW is Volkswagen do Brasil; the L in position 10 is 2020.
  const vin = page.getByRole("region", { name: "Buscar pelo chassi (VIN)" });
  await expect(vin.getByRole("definition").filter({ hasText: "Volkswagen do Brasil" })).toBeVisible();
  await expect(vin.getByRole("definition").filter({ hasText: /^2020/ })).toBeVisible();
  // And the catalog is filtered by them.
  await expect(vin.getByText("Filtros aplicados: VW - VolksWagen · ano 2020.")).toBeVisible();
});
