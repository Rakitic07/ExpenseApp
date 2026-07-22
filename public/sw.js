/* Spendly-Plus service worker.
 *
 * Goal: make the app installable and resilient offline WITHOUT caching any
 * sensitive/dynamic data. Auth and expense APIs are never cached — they always
 * go to the network so the phone and web stay in sync and no private data is
 * persisted on disk by the SW. Only the static app shell is cached.
 */
const CACHE = "spendly-plus-shell-v1";

// The app shell we can safely precache for an offline fallback.
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; never touch POST/PATCH/DELETE (mutations must hit network).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only; let cross-origin requests pass straight through.
  if (url.origin !== self.location.origin) return;

  // Never cache API traffic — it's dynamic and auth-sensitive. Network only.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations (HTML): network-first with an offline shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets (JS/CSS/images/fonts): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
