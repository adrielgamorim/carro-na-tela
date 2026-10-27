// Service worker of the production build (registered in src/main.tsx).
// - /assets/ files have a content hash in the name: cache first.
// - The page and the catalog JSONs change (daily update): network first, the
//   cache only when offline, so the last catalog seen still opens.
// - The FIPE proxy (/api/) is never cached here; it has its own cache.
// Bump the version to drop every cached file.

const cacheName = "carro-na-tela-v1";
const scope = new URL(self.registration.scope);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== cacheName).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(cacheName)).put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  if (path.startsWith("api/")) return;

  if (request.mode === "navigate") {
    // Every view is the same page (?view=…): one cached copy serves all.
    event.respondWith(networkFirst(request, scope.href));
  } else if (path.startsWith("assets/")) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});
