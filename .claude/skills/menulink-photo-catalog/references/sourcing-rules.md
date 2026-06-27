# Sourcing rules (non-negotiable)

1. **Halal only.** No alcohol, pork, or non-halal imagery for Saudi tenants. A stock query like "carcade/hibiscus" can return cocktails with liquor bottles — audit every result.
2. **Audit before apply.** Never push an auto-fetched photo blind. Build a contact-sheet montage of the candidates (and the final stored images), *look*, then apply. A wrong-but-specific photo (live chickens for "nuggets") is worse than a neutral correct-category one.
3. **Reuse before fetching.** Check the catalog first: a sister tenant almost certainly has the branded sodas, Holsten flavors, karak, hookahs, and standard drinks already — copy those bytes. Fetch stock only for what we genuinely don't own.
4. **Branded products → real product shots, not generic.** Pepsi/7up/Code Red/Red Bull/Holsten/Mirinda must look like the actual can/bottle. Generic "soda glass" reads as wrong. These live in the library `cold-drinks/` (cached from clients) and in `client-photos.json`.
5. **Near-identical variants → one standard photo.** Mojito flavors, shisha heads, holsten flavors: one good shot for all, swap later.
6. **Keep the owner's own English.** If the POS export has English, use it verbatim; only translate true gaps.
7. **Cache-bust on re-upload.** Append `?v=N` to the public URL when replacing an existing `<slug>.webp` so the CDN/browser refetches.
8. **Pipeline constants.** `sharp` → `resize({width:800, withoutEnlargement:true})` → `webp({quality:80})`; Storage path `menu-images/<rid>/menu/<slug>.webp`; Storage auth uses the **legacy service_role JWT** (new `sb_secret` format returns 403); DB update via `UPDATE menu_items SET image_url = CASE slug ... END WHERE restaurant_id=... AND slug IN (...)`.
