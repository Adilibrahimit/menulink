// Serve menu photos at the size they're actually displayed.
//
// Why: stored originals average ~150 KB and the worst are 2.4 MB PNGs, but a
// menu card renders at ~170 CSS px on a phone. Downloading + decoding 60-260
// full-size images is what made scrolling heavy. Supabase Storage's render
// endpoint resizes on the fly AND content-negotiates WebP, which measured 12 KB
// vs 27 KB for the same card image (-56%), and far more on the oversized PNGs.
//
// Transformation is enabled on this project (verified 2026-07-25: the render
// endpoint returns 200 + image/webp when the browser sends an Accept for it).
//
// NOTE: the render endpoint still answers `Cache-Control: no-cache`, so the
// service worker (public/sw.js) is what actually stops the scroll-back flicker.
// Both halves are needed — this one cuts bytes, the SW keeps them.

/** Widths keyed by where the image appears. Values are CSS px * ~2 for DPR. */
export const IMG = {
  cartThumb: 160,
  listRow: 240,
  card: 400,
  detail: 800,
  hero: 1200,
} as const;

const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

/**
 * Rewrite a Supabase Storage public URL to the transforming endpoint at `width`.
 *
 * Anything that isn't a Supabase Storage object URL is returned untouched —
 * local `/menu/koko/*.jpeg` paths, data URIs, and third-party URLs all pass
 * through, so this is safe to wrap around any image_url.
 *
 * Existing `?v=N` cache-busters (see learnings LRN-2026-06-05) are preserved.
 */
export function sizedImage(url: string | null | undefined, width: number): string | null {
  if (!url) return null;
  if (!url.includes(OBJECT_PATH)) return url;

  const [base, query] = url.split("?", 2);
  const params = new URLSearchParams(query || "");
  params.set("width", String(width));
  params.set("quality", "70");
  // Width only == proportional scale. No `resize`/`height`: the call sites all
  // use CSS object-cover, so let the browser do the cropping and keep the
  // transform to one variant per width (better CDN hit rate).

  return base.replace(OBJECT_PATH, RENDER_PATH) + "?" + params.toString();
}
