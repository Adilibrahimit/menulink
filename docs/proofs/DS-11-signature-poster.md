# DS-11 · Signature Menu Poster (`size=poster`)

## Goal

Add a single-page, print-ready **"signature poster"** output to the existing print
route at `app/print/[slug]/[size]/`. Where `a4` / `a3` render the full booklet
menu (DS-10), `poster` renders one curated, luxe-framed A4 page: a header strip
(logo · brand · order-QR), an icon category nav, a hero "signature dish", a
"today's offer" band, up to four photo sections, and an SFDA/VAT footer.

It is the productized version of the hand-built, already-approved reference
`docs/screenshots-tsests/rzrz-poster-options/option-3-luxe-framed.html`
(proof render: `rzrz-poster-options/FINAL-rzrz-poster-live.png`), made fully
data-driven so it works for **any** tenant from live MenuLink menu data.

## Files changed

| File | Change |
|---|---|
| `apps/web/app/print/[slug]/[size]/menu-poster.tsx` | **New.** `MenuPoster` component + `curate()` / `buildSections()` / `posterHasPhotos()`. Token-driven (dark/gold for premium-epicurean, light/brand otherwise). |
| `apps/web/app/print/[slug]/[size]/page.tsx` | Import `MenuPoster, { posterHasPhotos }`; add a `params.size === "poster" && posterHasPhotos(menu)` branch that renders the poster (with a no-print PrintButton). Otherwise falls through to the existing A4/A3 menu. |

No migration, no new dependency, no schema change, no POS change. Purely additive
on top of the existing `get_public_menu(slug)` RPC.

## How curation works (no invented data)

- **hero** = the photo item with the highest price.
- **offer** = the next-priciest photo item in a *different* category (falls back to #2).
- **sections** = up to 4 categories in menu order, photo items only, hero/offer
  excluded. Strict pass requires ≥2 items per section (balanced rows); if that
  yields fewer than 2 sections (sparse menu) a **lenient pass** drops the floor
  to 1 so the poster is never half-empty.
- **nav** = first 6 categories (emoji + name).
- All prices, names, calories, logo, city, tagline come from the DB. Images are
  the item's `image_url`, falling back to the existing `SLUG_TO_IMG` map
  (KO-KO's local photo set) — no AI/placeholder images.

### Hardening added in this phase (over the initial draft)

- Extracted `buildSections(cats, used, minPer)` + the strict→lenient retry so a
  low-photo menu still fills the page.
- Exported `posterHasPhotos(menu)`; `page.tsx` uses it to **fall through to the
  standard print menu** when a tenant has no usable photos, instead of rendering
  an empty gold frame.

## Commands run

```
cd apps/web
npx tsc --noEmit          # exit 0, no errors
PORT=3007 npm run dev     # Ready in 2.8s
npm run build             # production build (Vercel parity)
```

## Verification (dev server, localhost:3007)

| Route | Status | Result |
|---|---|---|
| `/print/koko/poster` | 200 (43.8 KB) | `.pmp` framed poster · hero · offer · **4 sections / 13 item cards** · real QR `<svg>` · "امسح للطلب" · local `/menu/koko/*.jpg` photos |
| `/print/rzrz-bukhari-test/poster` | 200 (43.2 KB) | framed poster · hero · offer · **4 sections / 14 item cards** · **14 real Supabase storage photos** · real QR |
| `/print/koko/a4` | 200 | standard `print-root` menu, **no `.pmp`** — DS-10 regression clean |
| `/print/sadaf-bukhari/poster` | 200 | **falls through** to standard menu (`print-root`, no `.pmp`) — sparse-tenant guard works |
| `/print/zzz-nope/poster` | 404 | `notFound()` for unknown slug |

## Guardrails verified

- Did **not** redesign `/m/[slug]`; did not touch POS, loyalty, or auth.
- Did **not** add a migration or dependency; change is additive to the print route.
- KO-KO and RzRz both render; A3/A4 booklet output unchanged.
- No hardcoded tenant IDs in the component; works for any slug.
- All output generated from live menu data; no AI-generated food images.
- QR renders dark-on-light regardless of palette (readability > styling).
- Unrelated working-tree changes (the deleted `docs/menulink_global_ops_plan_md_files/*`
  legacy plan files) are **excluded** from this branch.

## Known limitations

- The poster targets **A4**; there is no A3 poster variant (the A3 size still
  maps to the booklet menu — intentional).
- Curation is heuristic (price-ranked). There is no per-tenant override yet to
  pin a specific hero/offer; that can be a later DS phase if requested.
- Like the rest of the print route, this is a browser **print-to-PDF** surface;
  server-side PDF rendering remains deferred (consistent with DS-5/DS-7 scope).

## Next recommended phase

- Optional: ops "signature dish / offer" override fields so the poster's hero and
  offer can be curated by hand instead of price-ranked.
- Optional: wire a "بوستر A4" download/preview button into the ops Outputs tab
  alongside the existing A4/A3 menu exports.
