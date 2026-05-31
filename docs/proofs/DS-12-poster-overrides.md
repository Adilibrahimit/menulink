# DS-12 · Poster Signature Overrides (pin hero / offer)

## Goal

Let ops hand-pick the signature poster's **hero (signature dish)** and
**offer item** instead of relying solely on the automatic price-rank curation
introduced in DS-11. Both are optional: leaving them unset keeps the existing
"most expensive photo item" behavior, so nothing changes for tenants that don't
opt in.

This is the "Next recommended phase" called out at the end of the DS-11 proof.

## Storage decision

The two pins live as **nullable columns on `restaurants`**, not on
`restaurant_print_profiles`. Reason: the poster page (`/print/<slug>/poster`)
renders for **anonymous public QR visitors**, so it reads `restaurants` through
the anon client (anon-readable via the `public_read_published_restaurants`
policy, migration 0020). `restaurant_print_profiles` is ops/owner-only and would
not be visible to the anon render path. This mirrors the `menu_design_key`
precedent (migration 0069): a nullable additive column on `restaurants`, read by
the print page via the anon client and edited from the ops design studio.

## Files changed

| File | Change |
|---|---|
| `apps/web/supabase/migrations/0070_poster_signature_overrides.sql` | **New.** Adds `poster_hero_item_id` + `poster_offer_item_id` (both `uuid`, nullable, `references menu_items(id) on delete set null`). |
| `apps/web/app/print/[slug]/[size]/menu-poster.tsx` | `curate()` now takes `overrides { heroId, offerId }`. A pinned id is honored **only** if that item is still in the live photo-item set; otherwise it falls back to auto. Offer fallback hardened so it can't collide with the hero. New `Placed` / `Overrides` types; `MenuPoster` gains `heroItemId` / `offerItemId` props. |
| `apps/web/app/print/[slug]/[size]/page.tsx` | Restaurants select extended to read the two override columns; ids passed into `<MenuPoster>`. |
| `apps/web/app/ops/tenants/[id]/design/page.tsx` | Restaurants select extended; fetches `get_public_menu(slug)` to build a photo-only `posterItems` list (id + name + category); passes pins + items to `OutputsTab`. |
| `apps/web/app/ops/tenants/[id]/design/outputs-tab.tsx` | Now `"use client"`. Keeps the print-links card; adds a "تخصيص بوستر التوقيع" card with two dropdowns (default option = "تلقائي (الأغلى سعراً)") that save via the browser anon client `.update(restaurants)`. Shows a "no photo items yet" notice when the list is empty. |

## How the override is re-validated (no stale / cross-tenant leakage)

`curate()` resolves a pin through `pinned(id)`, which looks the id up **inside
the current tenant's live photo-item set**:

```ts
const pinned = (id) => id ? photoItems.find((x) => x.it.id === id) ?? null : null;
const hero  = pinned(overrides.heroId)  ?? byPrice[0];
const offer = pinned(overrides.offerId)
  ?? byPrice.find((x) => x.it.id !== hero?.it.id && x.cat.id !== hero?.cat.id)
  ?? byPrice.find((x) => x.it.id !== hero?.it.id);
```

So a pin that points at a deleted item, a photo-less item, or an item from a
different tenant simply **isn't found → falls back to auto**. The FK
(`on delete set null`) also nulls a pin if its item row is deleted. There is no
path by which a bad pin renders a broken or foreign card.

## Migration applied

```sql
alter table public.restaurants
  add column if not exists poster_hero_item_id  uuid
    references public.menu_items(id) on delete set null,
  add column if not exists poster_offer_item_id uuid
    references public.menu_items(id) on delete set null;
```

Applied to the cloud project (`dhmjrrsynfvomlzhggvu`) via the Management API and
verified: both columns present, type `uuid`, nullable, FK `confdeltype='n'`
(SET NULL).

## Commands run

```
cd apps/web
npx tsc --noEmit          # exit 0, no errors
npm run build             # production build (Vercel parity), succeeded
```

## Verification (cloud DB on the TEST clone rzrz-bukhari-test — never production)

| Case | Setup | Result |
|---|---|---|
| **Pin honored** | rzrz hero→أوصال لحم, offer→أم علي | poster hero=أوصال لحم, offer=أم علي (overrode auto); pinned hero **not** duplicated in sections ✓ |
| **Auto (no pin)** | koko, both NULL | auto price-rank: hero=بروستد لهاليبو, offer=تندر عادي ✓ |
| **FK integrity** | pin = bogus uuid | rejected by FK constraint ✓ |
| **Stale / cross-tenant pin** | rzrz hero = a *koko* item id (FK-valid, absent from rzrz menu) | `curate()` falls back to auto (كبسة لحم كابلي); **zero** cross-tenant leakage ✓ |
| **Ops tab auth** | GET ops outputs tab unauthenticated | 307 → /ops/login (gate works, no app error) ✓ |
| **Reset** | rzrz pins → NULL after testing | auto restored: hero=كبسة لحم كابلي, offer=مشوي مشكل ✓ |

Test pins were reset to NULL afterwards, leaving rzrz-bukhari-test in a clean
auto state.

## Guardrails

- Tested on the **clone** (`rzrz-bukhari-test`), not the live koko / rzrz-bukhari
  tenants.
- Additive only: NULL pins reproduce DS-11 behavior exactly; no change for
  non-opted-in tenants.
- Anon read path preserved (columns on `restaurants`, not the ops-only profile
  table).
- Pins re-validated at render against the live menu — a deleted / photo-less /
  cross-tenant id can never render a broken or foreign card.
- No POS / loyalty / auth / `/m/[slug]` changes.
- Unrelated working-tree changes (the deleted `docs/menulink_global_ops_plan_md_files/*`
  legacy plan files and untracked scratch `docs/` folders) are **excluded** from
  this branch.

## Known limitations

- The dropdowns list **photo items only** (a poster card needs an image); a
  tenant with zero photo items sees a "add photos to enable" notice instead.
- Pins are by item id; if ops pins an item and later removes its photo, the pin
  silently falls back to auto (by design — the poster never shows an imageless
  hero).
- Still a browser print-to-PDF surface; server-side PDF remains deferred
  (consistent with DS-5 / DS-7 scope).
