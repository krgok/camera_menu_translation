/*
 * Service worker: makes the app shell available offline.
 *
 * What it caches:  the HTML shell and the hashed /assets/* bundles, icons, manifest.
 * What it NEVER caches:  /api/* (auth + paid calls + quota) and every cross-origin
 * request (Supabase, Google). Those always go straight to the network.
 *
 * Bump VERSION to drop all old caches on the next activation.
 */
const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const MAX_ASSETS = 60;
const STATIC = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(STATIC);
      // Pre-cache the bundles the HTML references so the very first offline
      // launch works (not only the second one).
      const html = await (await fetch("/", { cache: "no-store" })).text();
      const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      const assets = await caches.open(ASSET_CACHE);
      await Promise.all(urls.map((u) => assets.add(u).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      for (const key of await caches.keys()) {
        if (!keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page loads: network first (so a new deploy shows up), cache when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) (await caches.open(SHELL_CACHE)).put("/", res.clone());
          return res;
        } catch {
          return (await caches.match("/")) || Response.error();
        }
      })(),
    );
    return;
  }

  // Hashed bundles never change for a given URL: cache first.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(ASSET_CACHE);
          await cache.put(req, res.clone());
          await trim(cache);
        }
        return res;
      })(),
    );
    return;
  }

  // Icons, manifest: serve cached, refresh in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      const refresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    })(),
  );
});
