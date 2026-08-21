/* ServisDrama update-safe service worker */
const BUILD_ID = '20260821-talep-v4';
const CACHE_NAME = `servisdrama-${BUILD_ID}`;
const OFFLINE_FILES = [
  '/',
  '/index.html',
  '/admin.html',
  '/sales.html',
  '/sales.js',
  '/sales.css',
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

/* ── Push bildirimleri (Web Push / VAPID) ─────────────────────────────
   Sunucu tarafı: utils/webPush.js. Uygulama TAMAMEN KAPALI olsa bile bu iki
   event, tarayıcı/işletim sistemi tarafından service worker'ı arka planda
   uyandırıp çalıştırır — mevcut install/activate/fetch/message
   dinleyicilerine dokunulmadı, yalnızca eklendi. */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { title: 'ServisDrama', body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'ServisDrama';
  const options = {
    body: data.body || '',
    icon: '/assets/pwa/icon-192.png',
    badge: '/assets/pwa/icon-192.png',
    tag: data.tag || 'servisdrama',
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Zaten açık bir sekme varsa onu hedef sayfaya yönlendirip öne getir;
    // yeni bir sekme açmak PWA'yı ikinci kez başlatmış gibi görünürdü.
    const existing = clientsList.find(c => new URL(c.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url).catch(() => {});
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});
