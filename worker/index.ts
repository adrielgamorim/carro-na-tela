// Cloudflare Worker serving the FIPE proxy in production.
//
//   npx wrangler secret put FIPE_PROXY_TOKEN   # chave da FIPE, guardada como segredo
//   (mais chaves, se quiser: FIPE_TOKEN, FIPE_TOKEN1, FIPE_TOKEN2… — ver proxyTokensFromEnv)
//   npx wrangler deploy
//
// Then build the site with VITE_FIPE_API_URL pointing at this Worker, e.g.
// VITE_FIPE_API_URL=https://fipe.seu-dominio.com.br/api/fipe

import { createFipeProxy, proxyTokensFromEnv } from "../server/fipe-proxy.ts";
import type { ProxyCache } from "../server/fipe-proxy.ts";

interface Env {
  /** FIPE_PROXY_TOKEN, FIPE_TOKEN, FIPE_TOKEN1…: secrets with the FIPE keys. */
  [name: string]: unknown;
  /** Comma-separated origins allowed to call the proxy, or "*". */
  ALLOWED_ORIGINS?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

declare const caches: { default: ProxyCache };

// One proxy per Worker instance, so a used-up key stays skipped across requests.
let handle: ReturnType<typeof createFipeProxy> | undefined;

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = `${url.pathname.replace(/^\/api\/fipe/, "") || "/"}${url.search}`;
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
