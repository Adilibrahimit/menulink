/* ===========================================================================
 *  MenuLink Service Worker
 *
 *  Strategy (DESIGN.md §6 + the v6 SW lesson — see learnings.md):
 *    - HTML / navigation requests: network-first, fall back to cache
 *      (deploys are visible on every visit; no stale HTML trap)
 *    - Static assets (images, JS, CSS, fonts): cache-first
 *      stale-while-revalidate
 *    - WhatsApp / Supabase / map tiles: passthrough (never intercept)
 *    - Submit_order: passthrough (always network, never cache; offline
 *      submission falls open inside the client per persistOrder)
 *
 *  Versioned cache name so deploys clear old caches in the activate handler.
 *  Bump VERSION on any meaningful SW change.
 * ========================================================================= */

const VERSION = "menulink-sw-v1.3.0";
const HTML_CACHE = `menulink-html-${VERSION}`;
const ASSET_CACHE = `menulink-assets-${VERSION}`;

const PASSTHROUGH_HOSTS = new Set([
  "wa.me",
  "api.whatsapp.com",
  "www.google.com",
  "maps.google.com",
]);

self.addEventListener("install", (event) => {
  // Activate immediately on first install so customers don't need a second
  // reload to start benefiting from caching.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const stale = keys.filter((k) => k !== HTML_CACHE && k !== ASSET_CACHE);
      await Promise.all(stale.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept external services
  if (PASSTHROUGH_HOSTS.has(url.hostname)) return;

  // Supabase: the API surface (rest / auth / realtime / functions) must never
  // be cached. Storage IMAGES must be — Storage answers `Cache-Control:
  // no-cache` on both the object and the render endpoint, and this SW used to
  // skip the whole host, so menu photos had no cache at any layer. Scrolling
  // down and back up re-fetched every photo, which is what showed up as images
  // vanishing and reappearing. A photo's URL changes when the photo changes
  // (new object path, or a ?v= bump per learnings LRN-2026-06-05), so a cached
  // entry can never go stale under us.
  if (url.hostname.endsWith(".supabase.co")) {
    const isStorageImage =
      url.pathname.startsWith("/storage/v1/object/public/") ||
      url.pathname.startsWith("/storage/v1/render/image/public/");
    if (!isStorageImage) return;
    event.respondWith(cacheFirstImage(req));
    return;
  }

  if (url.hostname.endsWith(".tile.openstreetmap.org")) return;
  if (url.hostname.endsWith(".basemaps.cartocdn.com")) return;
  if (url.protocol === "tel:") return;

  // Only handle our own origin
  if (url.origin !== self.location.origin) return;

  const isHtml =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHtml) {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  // Static assets — cache-first SWR
  event.respondWith(cacheFirstAsset(req));
});

async function networkFirstHtml(req) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const copy = fresh.clone();
      caches.open(HTML_CACHE).then((c) => c.put(req, copy));
    }
    return fresh;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Last-resort fallback — try the menu page
    return (
      (await caches.match(new Request(req.url, { method: "GET" }))) ||
      Response.error()
    );
  }
}

// --- Push notifications ---------------------------------------------------

self.addEventListener("push", (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "MenuLink";
    const options = {
      body: data.body || "",
      icon: data.icon || "/menulink-logo.png",
      badge: data.badge || "/menulink-logo.png",
      data: { url: data.url || "/" },
      dir: "rtl",
      lang: "ar",
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("[SW] push handler error:", err);
    event.waitUntil(
      self.registration.showNotification("MenuLink", { body: "لديك إشعار جديد" })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});

// --- Caching strategies ---------------------------------------------------

/**
 * Cache-first for Supabase Storage photos.
 *
 * Why this isn't just cacheFirstAsset: a plain `<img src>` is a `no-cors`
 * request, and `fetch(req)` on one yields an OPAQUE response — status 0,
 * `ok === false`. The generic helper only caches when `fresh.ok`, so nothing was
 * ever stored and every scroll-back re-downloaded the photo: the caching was a
 * no-op that looked correct.
 *
 * The fix is to re-issue the miss as a CORS request. Storage answers
 * `Access-Control-Allow-Origin: *` on both /object/public and
 * /render/image/public, so we get a real, cacheable response back. The explicit
 * Accept matters: the render endpoint content-negotiates, and a bare fetch
 * (Accept: * / *) would hand back JPEG instead of the WebP the sizing work
 * relies on. Accept is CORS-safelisted, so this still costs no preflight.
 *
 * Verified 2026-08-04: the render endpoint sends no `Vary`, so a stored CORS
 * response matches a later no-cors lookup. `ignoreVary` keeps that true if
 * Supabase ever adds one.
 *
 * No revalidation: photo URLs are effectively content-addressed (a new upload
 * gets a new random path; re-applied photos get a ?v= bump per LRN-2026-06-05),
 * so a hit is always correct and revalidating would fire 60-260 needless
 * requests per page view on a phone.
 */
const IMG_MATCH = { ignoreVary: true };

async function cacheFirstImage(req) {
  const cached = await caches.match(req, IMG_MATCH);
  if (cached) return cached;

  const fresh = await fetch(req.url, {
    mode: "cors",
    credentials: "omit",
    headers: { Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
  }).catch(() => null);

  if (fresh && fresh.ok) {
    const copy = fresh.clone();
    caches.open(ASSET_CACHE).then((c) => c.put(req.url, copy)).catch(() => {});
    return fresh;
  }
  // CORS refetch failed (offline, or an origin that doesn't send ACAO):
  // fall back to the browser's own request so the image still renders.
  return fetch(req);
}

async function cacheFirstAsset(req, { revalidate = true } = {}) {
  const cached = await caches.match(req);
  if (cached) {
    if (revalidate) {
      fetch(req)
        .then((fresh) => {
          if (fresh && fresh.ok) {
            caches.open(ASSET_CACHE).then((c) => c.put(req, fresh.clone()));
          }
        })
        .catch(() => {});
    }
    return cached;
  }
  const fresh = await fetch(req).catch(() => null);
  if (fresh && fresh.ok) {
    const copy = fresh.clone();
    caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
  }
  return fresh || Response.error();
}
