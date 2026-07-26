/* Spendly-Plus service worker.
 *
 * Goal: make the app installable and resilient offline WITHOUT ever shadowing a
 * new build with stale assets. Auth/expense APIs are never cached. Navigations
 * are network-first (always fresh HTML), and hashed build assets are cached by
 * their content-addressed URL. On activation we purge every old cache and force
 * open tabs to reload under the new worker, so a version bump self-heals a
 * client that was left running stale chunks from a previous build.
 */
const CACHE = "spendly-plus-shell-v4";

// The app shell we can safely precache for an offline fallback.
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache that isn't the current version (e.g. stale _next
      // chunks left over from an earlier build/framework upgrade).
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Force any open tab to reload under this worker so it stops executing
      // stale chunks. Runs once per worker version.
      const windows = await self.clients.matchAll({ type: "window" });
      await Promise.all(
        windows.map((c) => {
          try {
            return c.navigate(c.url);
          } catch {
            return Promise.resolve();
          }
        })
      );
    })()
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

  // Build assets under /_next/static are content-hashed (the URL changes when
  // the content changes), so cache-first is safe and fast, and can never serve
  // a version-mismatched chunk.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        });
      })
    );
    return;
  }

  // Everything else (navigations, manifest, icons): stale-while-revalidate.
  // Serve the cached copy instantly for near-native launch speed — critical for
  // the native shell, which otherwise waits on a (possibly cold) remote server
  // on every launch — then refresh the cache in the background. The in-app
  // UpdatePrompt watches /api/version and offers a one-tap refresh when a new
  // build ships, so instant loads never leave the user stuck on stale content.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(
          () => cached || (request.mode === "navigate" ? caches.match("/") : undefined)
        );
      // Cached first (fast); fall back to the network on a cold cache.
      return cached || network;
    })
  );
});
