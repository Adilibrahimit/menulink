/* ============================================================
 *  KO-KO Service Worker · v1
 *  Caches the menu HTML + icons so the app works offline.
 *
 *  Strategy:
 *  - HTML/manifest/icons: cache-first (instant load, updates in background)
 *  - Map tiles + Leaflet CDN: network-first (always try fresh)
 *  - WhatsApp/Maps links: pass through (always live)
 * ============================================================ */

const VERSION       = 'koko-v1.1.0';
const CACHE_STATIC  = `koko-static-${VERSION}`;
const CACHE_RUNTIME = `koko-runtime-${VERSION}`;

const STATIC_ASSETS = [
  './',
  './koko-menu-v6.html',
  './manifest.json',
  './icon-72.png',
  './icon-96.png',
  './icon-144.png',
  './icon-152.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png',
  './favicon-16.png',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

/* -------- Install: precache static assets -------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) =>
      // addAll fails if any single request fails — use individual adds for resilience
      Promise.all(STATIC_ASSETS.map((url) =>
        cache.add(url).catch((err) => console.warn('[SW] skip cache:', url, err))
      ))
    ).then(() => self.skipWaiting())
  );
});

/* -------- Activate: clean up old caches -------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_STATIC && k !== CACHE_RUNTIME)
            .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* -------- Fetch: routing -------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache or intercept WhatsApp / Google Maps / tel: links
  if (url.hostname === 'wa.me' ||
      url.hostname === 'api.whatsapp.com' ||
      url.hostname === 'www.google.com' ||
      url.hostname === 'maps.google.com' ||
      url.protocol === 'tel:') {
    return; // let the browser handle it
  }

  // OSM tile images: network-first then cache (helps after first view)
  if (url.hostname.endsWith('.tile.openstreetmap.org')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_RUNTIME).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Navigation / HTML requests: network-first (so deploys take effect immediately).
  // Falls back to cache only if the network is unavailable.
  const isHtml = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');
  if (isHtml) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./koko-menu-v6.html')))
    );
    return;
  }

  // Static assets (icons, fonts, CDN libs): cache-first stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req).then((fresh) => {
          if (fresh && fresh.ok) {
            caches.open(CACHE_STATIC).then((c) => c.put(req, fresh.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.ok && (url.origin === self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE_STATIC).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

/* -------- Push notification handler (ready for Phase 3) --------
 *  When you add OneSignal / FCM later, this is where the messages arrive.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'KO-KO', body: event.data.text() }; }

  const options = {
    body: data.body || '',
    icon: data.icon || './icon-192.png',
    badge: './icon-96.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [120, 60, 120],
    data: { url: data.url || './koko-menu-v6.html' },
    actions: data.actions || [
      { action: 'open', title: '🛒 افتح القائمة' },
      { action: 'close', title: 'إغلاق' },
    ],
  };
  event.waitUntil(self.registration.showNotification(data.title || 'KO-KO', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
