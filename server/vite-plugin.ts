import type { Connect, Plugin } from "vite";
import { createFipeProxy, createMemoryCache } from "./fipe-proxy.ts";

interface FipeProxyPluginOptions {
  token?: string;
  /** Path the app calls; must match VITE_FIPE_API_URL (default "/api/fipe"). */
  mount?: string;
}

/** Serves the FIPE proxy on the Vite dev and preview servers. */
export function fipeProxyPlugin({
  token,
  mount = "/api/fipe",
}: FipeProxyPluginOptions = {}): Plugin {
  const handle = createFipeProxy({ token, cache: createMemoryCache() });

  // Connect strips the mount path from req.url, leaving "/cars/brands?…".
  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    try {
      const origin = req.headers.origin;
      const request = new Request(`http://localhost${req.originalUrl ?? req.url}`, {
        method: req.method,
        headers: origin ? { Origin: origin } : {},
      });
      const response = await handle(request, req.url ?? "/");
      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      next(error);
    }
  };

  return {
    name: "fipe-proxy",
    configureServer(server) {
      server.middlewares.use(mount, middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(mount, middleware);
    },
  };
}
