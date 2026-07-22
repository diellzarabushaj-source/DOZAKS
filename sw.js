const CACHE_NAME = 'dozaks-shell-v15-local-search';
const INDEX_CACHE = 'dozaks-search-index-v1';
const SHELL = ['/', '/index.html', '/app.css', '/app.js', '/db-client.js', '/drug-card-sync.js', '/ux.js', '/smart-search-ui.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => ![CACHE_NAME, INDEX_CACHE].includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/api/search-index') {
    event.respondWith((async () => {
      const cache = await caches.open(INDEX_CACHE);
      const cached = await cache.match(request);
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }

      return (await refresh) || new Response(JSON.stringify({
        error: 'Search index unavailable offline',
        code: 'SEARCH_INDEX_OFFLINE',
      }), {
        status: 503,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    })());
    return;
  }

  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', response.clone()));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (/\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
