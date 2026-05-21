/* Freshdesk Hero — Service Worker
 * Macht die App installierbar (Chrome-Pflicht) und cached die Shell
 * fuer minimalen Offline-Komfort. Network-first fuer HTML, Cache-Fallback. */

const CACHE_NAME = 'fdh-shell-v1';
const SHELL_URL  = './';

self.addEventListener('install', function (event) {
  // Sofort aktivieren, ohne auf Reload zu warten
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Pre-Cache der Shell — best-effort, nicht blockierend
      return cache.add(SHELL_URL).catch(function () {});
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    Promise.all([
      // Alte Caches loeschen
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) {
          if (k !== CACHE_NAME) return caches.delete(k);
        }));
      }),
      // Sofort Kontrolle uebernehmen
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Nur same-origin Requests anfassen — CDN/Tailwind/Lucide/etc. ungestoert lassen
  if (url.origin !== self.location.origin) return;
  // API-Routen sollen NIE gecached werden
  if (url.pathname.includes('/api/') || url.pathname.includes('/anthropic/') ||
      url.pathname.includes('/freshdesk/') || url.pathname.includes('/freshsales/') ||
      url.pathname.includes('/airtable/')) return;
  // Network-first fuer HTML, Cache-Fallback
  const isHtml = req.mode === 'navigate' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/');
  if (isHtml) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match(SHELL_URL);
        });
      })
    );
  }
});

// Cache leeren auf Anfrage (z.B. nach Update)
self.addEventListener('message', function (event) {
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});
