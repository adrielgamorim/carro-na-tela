// End-to-end tests of the main flows (e2e/*.e2e.ts), on the dev server and
// the catalog in public/catalog. Runs on the installed Chrome, so no browser
// download is needed; PLAYWRIGHT_CHANNEL=msedge (or "chromium", after
// `npx playwright install chromium`) picks another. E2E_BASE_URL points the
// tests at a server already running (http://localhost:5173) instead of
// starting one.
//
//   npm run test:e2e

import { defineConfig } from "@playwright/test";

const port = 5180;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // A fresh dev server transforms everything on the first page: ~50 s.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    locale: "pt-BR",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${port} --strictPort`,
        env: { E2E_CACHE_DIR: "node_modules/.vite-e2e" },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
