// Cloudflare Worker serving the FIPE proxy in production.
//
//   npx wrangler secret put FIPE_TOKEN     # chave da FIPE, guardada como segredo
//   npx wrangler deploy
//
// Then build the site with VITE_FIPE_API_URL pointing at this Worker, e.g.
// VITE_FIPE_API_URL=https://fipe.seu-dominio.com.br/api/fipe

import { createFipeProxy } from "../server/fipe-proxy.ts";
import type { ProxyCache } from "../server/fipe-proxy.ts";

interface Env {
  FIPE_TOKEN?: string;
  /** Comma-separated origins allowed to call the proxy, or "*". */
  ALLOWED_ORIGINS?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

declare const caches: { default: ProxyCache };

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = `${url.pathname.replace(/^\/api\/fipe/, "") || "/"}${url.search}`;
    const handle = createFipeProxy({
      token: env.FIPE_TOKEN?.trim() || undefined,
      allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
      cache: caches.default,
      waitUntil: (promise) => context.waitUntil(promise),
    });
    return handle(request, path);
  },
};
