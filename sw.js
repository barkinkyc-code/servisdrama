/* ServisDrama update-safe service worker */
const BUILD_ID = '20260806-tech-restore-v11';
const CACHE_NAME = `servisdrama-${BUILD_ID}`;
const OFFLINE_FILES = [
  '/',
  '/index.html',
  '/admin.html',
  '/tech.html',
  '/tech-mobile.html',
  '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_FILES))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_BUILD_ID') {
    event.source?.postMessage({ type: 'BUILD_ID', buildId: BUILD_ID });
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations and application files always prefer the network so a home-screen
  // launch receives the latest Vercel deployment. Cache is only an offline fallback.
  const isNavigation = request.mode === 'navigate';
  const isAppFile = /\.(?:html|js|css|webmanifest)$/.test(url.pathname) || url.pathname === '/';

  if (isNavigation || isAppFile) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match(request)) || (await caches.match('/index.html'));
      }
    })());
    return;
  }

  // Images/fonts: use cache when available, refresh it in the background.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const networkPromise = fetch(request).then(async response => {
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }).catch(() => null);
    return cached || networkPromise || Response.error();
  })());
});
