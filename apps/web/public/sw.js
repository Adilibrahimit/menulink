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

const VERSION = "menulink-sw-v1.2.0";
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
    event.respondWith(cacheFirstAsset(req, { revalidate: false }));
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

// `revalidate: false` = pure cache-first, no background refetch. Used for
// Storage images: their URL is effectively content-addressed, so a hit is
// always correct, and revalidating would fire one needless request per photo
// per page view (60-260 of them) on a mobile connection.
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
