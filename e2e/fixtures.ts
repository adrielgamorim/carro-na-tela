import { test as base, expect } from "@playwright/test";

/**
 * Every test runs offline: requests to other hosts (Wikimedia thumbnails,
 * Flickr photos, the FIPE API) are answered by the test or aborted, so a
 * slow or missing network never makes a flow fail.
 */
export const test = base.extend({
  page: async ({ page, baseURL }, provide) => {
    // By host, not origin: Vite's hot-reload socket is ws://, and without it
    // the page keeps reloading.
    const host = new URL(baseURL!).host;
    await page.route(
      (url) => url.host !== host,
      (route) => route.abort(),
    );
    // The FIPE proxy would call the real API (with the .env keys): the catalog
    // tests need only public/catalog, so it answers "unavailable" at once.
    await page.route("**/api/fipe/**", (route) => route.fulfill({ status: 503, body: "{}" }));
    await provide(page);
  },
});

export { expect };
