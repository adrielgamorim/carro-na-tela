// Cloudflare Worker serving the site in production (wrangler.toml): the build
// in dist/ as static assets, and the FIPE proxy at /api/fipe, on one domain.
// Only /api/* runs this code (run_worker_first); every other request is
// answered from the assets directly.
//
//   npx wrangler secret put FIPE_PROXY_TOKEN   # chave da FIPE, guardada como segredo
//   (mais chaves, se quiser: FIPE_TOKEN, FIPE_TOKEN1, FIPE_TOKEN2… — ver proxyTokensFromEnv)
//   npm run build && npx wrangler deploy

import { createFipeProxy, proxyTokensFromEnv } from "../server/fipe-proxy.ts";
import type { ProxyCache } from "../server/fipe-proxy.ts";

interface Env {
  /** FIPE_PROXY_TOKEN, FIPE_TOKEN, FIPE_TOKEN1…: secrets with the FIPE keys. */
  [name: string]: unknown;
  /** Comma-separated origins allowed to call the proxy, or "*". */
  ALLOWED_ORIGINS?: string;
  /** The static assets (dist/). */
  ASSETS: { fetch(request: Request): Promise<Response> };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

declare const caches: { default: ProxyCache };

const proxyPrefix = /^\/api\/fipe(?=\/|$)/;

// One proxy per Worker instance, so a used-up key stays skipped across requests.
let handle: ReturnType<typeof createFipeProxy> | undefined;

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!proxyPrefix.test(url.pathname)) return env.ASSETS.fetch(request);
    const path = `${url.pathname.replace(proxyPrefix, "") || "/"}${url.search}`;
    handle ??= createFipeProxy({
      tokens: proxyTokensFromEnv(env),
      allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      cache: caches.default,
    });
    return handle(request, path, { waitUntil: (promise) => context.waitUntil(promise) });
  },
};
