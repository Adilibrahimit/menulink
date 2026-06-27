---
name: menulink-photo-catalog
description: >-
  Source, match, and catalog menu-item PHOTOS for MenuLink restaurant tenants.
  Use this whenever a new (or existing) client needs per-item food/drink photos —
  especially when they have NO photos of their own — or when asked to "find photos
  for the menu", "fill missing item photos", organize/rename the photo library, or
  rebuild the photo catalog. Covers: matching a menu against our owned photos
  (local library + every photo already used by koko/rzrz/mazaj/coffee-secret),
  gap-filling from Pexels/web, the upload pipeline, and re-generating the catalog.
---

# MenuLink Photo Catalog

Sourcing per-item photos is the slowest, most error-prone onboarding step. This skill makes it fast and safe by giving you **one growing catalog of every photo we own** plus a disciplined match → gap-fill → upload → re-catalog loop.

## What we own (the catalog feeds)

1. **Local library** — `docs/clients/ITEMS_PHOTO/OneDrive_2026-05-25/Menu Pics/` (gitignored). Organized into **category sub-folders** (`coffee/ cold-drinks/ juices/ milkshakes/ tea/ mojito/ desserts/ ice-cream/ fruit-salads/ salads/ sandwiches/ appetizers/ mains/ shisha/ misc/`), filename == dish slug. `_review/` holds non-food / unusable files.
2. **Every live client's matched photos** — koko, rzrz-bukhari, mazaj-almosafer, coffee-secret. These are dish-correct and **reusable across clients** (the proven "same as almosafer" trick: branded sodas, Holsten flavors, a standard mojito, hookahs, etc.). Their unique photos are also cached into the local library for offline reuse.
3. **Free sources** — Pexels (200/hr) + web search, used only to fill what we don't already own.

## Data files (`./data/`)

- `dish-dictionary.json` — canonical AR+EN+category vocabulary, derived from all tenants' `menu_items`.
- `client-photos.json` — every client photo with its public URL, provenance, and (if cached) local path.
- `photo-catalog.json` — **the master index** (committed): every dish → `{name_ar, name_en, category, sources[]}`.
- `photo-catalog.xlsx` — the same, visual, with embedded thumbnails (generated locally, gitignored).

## Scripts (`scripts/catalog/`)

| Script | Does |
|---|---|
| `build-dish-dictionary.mjs` | rebuild `dish-dictionary.json` from the DB |
| `triage-library.mjs` | classify library files (named/unlabeled/junk) + build contact-sheet montages for vision-ID |
| `build-rename-map.mjs` | merge triage + vision labels → `rename-map.json` |
| `apply-rename.mjs` | rename to `<slug>.<ext>` + sort into category folders (+ `_review/`). `DRY=1` to preview |
| `pull-client-photos.mjs` | register client photos + download unique ones into the library |
| `build-photo-catalog.mjs` | regenerate `photo-catalog.json` + `.xlsx` |

`lib.mjs` holds shared helpers (DB `sql`, `sharp`, `slugify`, `canonicalCategory`, tenant IDs, paths). Secrets are read from env / the PAT memory file / `.env.local` — never hardcoded.

## Playbook — new client with no photos

1. **Parse the menu** → list of dishes with `name_ar` (+ `name_en` if present), and a `slug` per item.
2. **Match against the catalog.** For each dish, look it up in `photo-catalog.json` (by EN slug / AR name). Prefer a **library** source; otherwise reuse a **sister-client** photo (copy its bytes to the new tenant's path). This alone usually covers most coffee, desserts, juices, and all branded drinks.
3. **Gap-fill the rest** — see `references/query-library.md` for proven per-dish queries:
   - Pexels (audited), then web search, then a sensible neutral.
   - **ALWAYS audit before applying** (build a contact-sheet montage and *look* — see `references/vision-id-montage.md`). Auto-top-1 without a look is how an alcohol bottle and live chickens got shipped. See `references/sourcing-rules.md`.
   - **Halal only**: no alcohol / non-halal imagery for Saudi tenants.
4. **Upload** via the standard pipeline (reuse `scripts/coffee-secret-upload-photos.mjs` as the template): `sharp` → 800px / webp q80 → Storage `menu-images/<rid>/menu/<slug>.webp` → bulk `UPDATE menu_items SET image_url = CASE slug ...`. For the mechanics, defer to the `menu-onboarding` skill (don't duplicate).
5. **Re-catalog** — run `node scripts/catalog/pull-client-photos.mjs && node scripts/catalog/build-photo-catalog.mjs`. The new client's photos are now in the catalog for the *next* client. **This closing step is how new photos get added to the table.**

## Refreshing the library / catalog

- New raw photos dropped into `ITEMS_PHOTO/`: run `triage-library.mjs` → vision-ID the new montages (a `catalog-vision-id` Workflow, one agent per sheet) → `build-rename-map.mjs` → `apply-rename.mjs` → `build-photo-catalog.mjs`.
- After any onboarding: just re-run the last two scripts.

## Golden rule

After any photo session, append what you learned to [`learnings.md`](./learnings.md) — which queries worked, which dishes are hard, new reuse tricks.
