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

const VERSION = "menulink-sw-v1.0.0";
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
  if (url.hostname.endsWith(".supabase.co")) return;
  if (url.hostname.endsWith(".tile.openstreetmap.org")) return;
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

async function cacheFirstAsset(req) {
  const cached = await caches.match(req);
  if (cached) {
    // Background refresh
    fetch(req)
      .then((fresh) => {
        if (fresh && fresh.ok) {
          caches.open(ASSET_CACHE).then((c) => c.put(req, fresh.clone()));
        }
      })
      .catch(() => {});
    return cached;
  }
  const fresh = await fetch(req).catch(() => null);
  if (fresh && fresh.ok) {
    const copy = fresh.clone();
    caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
  }
  return fresh || Response.error();
}
