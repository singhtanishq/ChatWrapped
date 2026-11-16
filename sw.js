/**
 * ChatWrapped service worker — offline support for a fully static site.
 *
 * Strategies:
 *  - navigations: network-first, fall back to the cached page, then to the
 *    cached app shell (so /app/ works offline after the first visit);
 *  - hashed build assets (/_astro/*): cache-first (immutable content);
 *  - fonts & public assets: cache-first with background refresh;
 *  - everything else: network-first with cache fallback.
 *
 * The worker never intercepts cross-origin requests to remote APIs — the
 * app makes none, but this also guards against future mistakes.
 */

const VERSION = "chatwrapped-v1";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pageCache = await caches.open(PAGE_CACHE);
      const scope = self.registration.scope;
      const shell = [scope, new URL("app/", scope).href];
      // Precache the built asset manifest (generated post-build) so the app
      // is fully available offline after the first visit, even for assets
      // that were fetched before the worker took control.
      try {
        const manifestUrl = new URL("precache-manifest.json", scope).href;
        const res = await fetch(manifestUrl, { cache: "no-cache" });
        if (res.ok) {
          const urls = await res.json();
          shell.push(manifestUrl, ...urls);
        }
      } catch {
        // manifest missing → runtime caching still applies
      }
      await Promise.allSettled(
        shell.map((u) => pageCache.add(new Request(u, { credentials: "same-origin" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // only our own static assets

  // Navigations: network-first with offline fallbacks.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(PAGE_CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => undefined);
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(PAGE_CACHE);
          return (
            (await cache.match(req.url)) ||
            (await cache.match(url.pathname, { ignoreVary: true })) ||
            (await cache.match(new URL("./app/", self.registration.scope))) ||
            (await cache.match(self.registration.scope)) ||
            new Response(
              "<h1>Offline</h1><p>ChatWrapped needs one online visit to cache its app shell.</p>",
              {
                status: 503,
                headers: { "Content-Type": "text/html" },
              },
            )
          );
        }),
    );
    return;
  }

  // Immutable hashed assets: cache-first.
  const isHashedAsset =
    url.pathname.includes("/_astro/") ||
    /\.(woff2?|png|svg|ico|webmanifest|css|js)$/.test(url.pathname);
  if (isHashedAsset) {
    event.respondWith(
      caches.match(req.url).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches
            .open(STATIC_CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => undefined);
          return res;
        });
      }),
    );
    return;
  }

  // Everything else (robots, sitemap…): network-first.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches
          .open(STATIC_CACHE)
          .then((c) => c.put(req, copy))
          .catch(() => undefined);
        return res;
      })
      .catch(async () => (await caches.match(req.url, { ignoreVary: true })) ?? Response.error()),
  );
});
