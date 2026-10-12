/* =========================================================
   U-AGRI — Service Worker
   Cache-first for static assets, network-first for navigation
   ========================================================= */

const CACHE_NAME = 'u-agri-v1.0.0';
const RUNTIME_CACHE = 'u-agri-runtime-v1.0.0';

/* Assets to precache on install */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

/* ---------------- INSTALL ---------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Precache failed:', err))
  );
});

/* ---------------- ACTIVATE ---------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---------------- FETCH ---------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  /* Only handle GET requests */
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Skip cross-origin requests (Google Maps, fonts, etc.) */
  if (url.origin !== self.location.origin) {
    return;
  }

  /* Navigation requests → network-first, fall back to cached index.html */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  /* Static assets → cache-first */
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

/* ---------------- MESSAGE ---------------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
