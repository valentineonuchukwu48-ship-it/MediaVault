/**
 * FacebookGrabContents service worker.
 *
 * Purpose: make the same engine-served UI installable as a real app on
 * Android (Chrome "Install" / Add to Home screen). The engine on the PC does
 * all the media work, so the phone always needs it online — no aggressive
 * offline caching that could serve a dead app shell.
 *
 *  - navigations: network-first, fall back to the cached shell only if the
 *    engine is briefly unreachable (and never for /api responses)
 *  - static assets: stale-while-revalidate (hashed filenames make this safe)
 *  - /api, /uploads, /audio, /samples, /video: always straight to network
 */

const CACHE = 'fgc-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/fgc-icon.png'];
const NETWORK_ONLY = /^\/(api|uploads|audio|samples|samples\/)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST /api traffic passes untouched

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cross-media CDNs pass through
  if (NETWORK_ONLY.test(url.pathname)) return;

  // SPA navigation: engine-first; cached shell only as a graceful fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets (hashed vite bundles) — stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
