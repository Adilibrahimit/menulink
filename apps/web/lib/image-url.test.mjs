// Self-check for sizedImage(). Run: node apps/web/lib/image-url.test.mjs
// No framework — asserts only. Covers the branches that would silently break
// menu photos if they regressed (pass-through, rewrite, ?v= preservation).
import assert from "node:assert/strict";

const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

// Kept in sync with lib/image-url.ts by hand (that file is TS; this runner is
// plain node). If you change the helper, change this copy and re-run.
function sizedImage(url, width) {
  if (!url) return null;
  if (!url.includes(OBJECT_PATH)) return url;
  const [base, query] = url.split("?", 2);
  const params = new URLSearchParams(query || "");
  params.set("width", String(width));
  params.set("quality", "70");
  return base.replace(OBJECT_PATH, RENDER_PATH) + "?" + params.toString();
}

const SB = "https://x.supabase.co";

// null / undefined / empty pass through as null
assert.equal(sizedImage(null, 400), null);
assert.equal(sizedImage(undefined, 400), null);
assert.equal(sizedImage("", 400), null);

// non-Supabase URLs are untouched — koko's local files must keep working
assert.equal(sizedImage("/menu/koko/broasted_regular.jpeg", 400), "/menu/koko/broasted_regular.jpeg");
assert.equal(sizedImage("https://images.unsplash.com/photo-1.jpg", 400), "https://images.unsplash.com/photo-1.jpg");
assert.equal(sizedImage("data:image/png;base64,AAAA", 400), "data:image/png;base64,AAAA");

// Supabase object URL -> render endpoint at the requested width
{
  const out = sizedImage(`${SB}${OBJECT_PATH}menu-images/rid/menu/a.jpg`, 400);
  assert.ok(out.startsWith(`${SB}${RENDER_PATH}menu-images/rid/menu/a.jpg?`), out);
  const p = new URL(out).searchParams;
  assert.equal(p.get("width"), "400");
  assert.equal(p.get("quality"), "70");
  assert.ok(!out.includes(OBJECT_PATH), "object path must be fully replaced");
}

// width is per-surface, not fixed
assert.equal(new URL(sizedImage(`${SB}${OBJECT_PATH}b/c.webp`, 160)).searchParams.get("width"), "160");
assert.equal(new URL(sizedImage(`${SB}${OBJECT_PATH}b/c.webp`, 1200)).searchParams.get("width"), "1200");

// an existing ?v= cache-buster survives (learnings LRN-2026-06-05: overwriting a
// storage path requires ?v=N, and dropping it would resurrect the stale photo)
{
  const p = new URL(sizedImage(`${SB}${OBJECT_PATH}b/c.webp?v=3`, 400)).searchParams;
  assert.equal(p.get("v"), "3");
  assert.equal(p.get("width"), "400");
}

// calling twice must not double-rewrite or stack params
{
  const once = sizedImage(`${SB}${OBJECT_PATH}b/c.webp`, 400);
  assert.equal(sizedImage(once, 400), once, "already-rendered URL must be left alone");
}

// --- fallbackToOriginal --------------------------------------------------
// Same hand-kept mirror as above.
function fallbackToOriginal(e) {
  const img = e.currentTarget;
  if (!img.src.includes(RENDER_PATH)) return;
  img.src = img.src.replace(RENDER_PATH, OBJECT_PATH).split("?")[0];
}

// a failed transform falls back to the original object URL, params dropped
{
  const img = { src: `${SB}${RENDER_PATH}menu-images/rid/a.jpg?width=400&quality=70` };
  fallbackToOriginal({ currentTarget: img });
  assert.equal(img.src, `${SB}${OBJECT_PATH}menu-images/rid/a.jpg`);
}

// and it must NOT loop: a second failure on the fallback URL is a no-op
{
  const img = { src: `${SB}${OBJECT_PATH}menu-images/rid/a.jpg` };
  fallbackToOriginal({ currentTarget: img });
  assert.equal(img.src, `${SB}${OBJECT_PATH}menu-images/rid/a.jpg`, "must be idempotent");
}

// a local/non-Supabase image that fails is left alone (nothing to fall back to)
{
  const img = { src: "/menu/koko/broasted_regular.jpeg" };
  fallbackToOriginal({ currentTarget: img });
  assert.equal(img.src, "/menu/koko/broasted_regular.jpeg");
}

console.log("image-url self-check: all assertions passed");
