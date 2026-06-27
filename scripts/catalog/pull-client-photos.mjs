// Phase 2 — register every live client's matched photos and gap-fill the local
// library with the unique ones (offline reuse — the "same as almosafer" pattern).
// Output: <skill>/data/client-photos.json + downloads into Menu Pics/<category>/.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sharp, sql, slugify, canonicalCategory, TENANTS, LIBRARY_ROOT, SKILL_DATA } from "./lib.mjs";

const KOKO_RID = TENANTS.koko;
const KOKO_PUBLIC = "D:/menulink/apps/web/public"; // static fallback files live here

// --- koko static fallback: parse apps/web/lib/koko-images.ts (SLUG_TO_IMG) ---
function kokoStaticMap() {
  const src = readFileSync("D:/menulink/apps/web/lib/koko-images.ts", "utf8");
  const img = {};
  for (const m of src.matchAll(/(\w+):\s*'([^']+)'/g)) img[m[1]] = m[2];
  const slugToPath = {};
  for (const m of src.matchAll(/'([^']+)':\s*IMG\.(\w+)/g)) if (img[m[2]]) slugToPath[m[1]] = img[m[2]];
  return slugToPath;
}
const kokoStatic = kokoStaticMap();

// --- current library coverage (post-rename) ---
function librarySlugs() {
  const set = new Set();
  for (const e of readdirSync(LIBRARY_ROOT, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === "_review") continue;
    for (const f of readdirSync(path.join(LIBRARY_ROOT, e.name))) {
      set.add(slugify(path.basename(f, path.extname(f)).replace(/-\d+$/, "")));
    }
  }
  return set;
}
const libSet = librarySlugs();
function covered(key) {
  if (libSet.has(key)) return true;
  for (const s of libSet) if (s.startsWith(key + "-") || key.startsWith(s + "-")) return true;
  return false;
}

const tenantList = Object.keys(TENANTS).map((s) => `'${s}'`).join(", ");
const rows = await sql(`
  select r.slug rest, i.slug, i.name_ar, i.name_en, i.image_url, c.slug cat_slug, c.name_ar cat_ar
  from menu_items i
  join restaurants r on r.id = i.restaurant_id
  join menu_categories c on c.id = i.category_id
  where r.slug in (${tenantList})
`);

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const byKey = new Map();
for (const r of rows) {
  let location = r.image_url, source = "client-storage";
  if (!location && r.rest === "koko" && kokoStatic[r.slug]) { location = kokoStatic[r.slug]; source = "koko-static"; }
  if (!location) continue;
  const key = slugify(r.name_en) || r.slug;
  const category = canonicalCategory(r.cat_slug, r.cat_ar, r.name_en, r.name_ar);
  let e = byKey.get(key);
  if (!e) { e = { key, name_ar: norm(r.name_ar), name_en: norm(r.name_en), category, sources: [] }; byKey.set(key, e); }
  if (!e.name_en && norm(r.name_en)) e.name_en = norm(r.name_en);
  if (!e.name_ar && norm(r.name_ar)) e.name_ar = norm(r.name_ar);
  e.sources.push({ type: source, location, provenance: r.rest });
}

// --- download a unique copy into the library for dishes we don't have yet ---
async function toLibrary(buf, category, key) {
  const dir = path.join(LIBRARY_ROOT, category || "misc");
  mkdirSync(dir, { recursive: true });
  const out = await sharp(buf).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const dest = path.join(dir, `${key}.webp`);
  writeFileSync(dest, out);
  return dest;
}
async function fetchBuf(src) {
  if (src.type === "koko-static") return readFileSync(path.join(KOKO_PUBLIC, src.location));
  const r = await fetch(src.location); if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

let downloaded = 0, already = 0, failed = 0;
const catalogClient = [];
for (const e of byKey.values()) {
  let cachedPath = null;
  if (!covered(e.key)) {
    const rep = e.sources[0];
    try { cachedPath = await toLibrary(await fetchBuf(rep), e.category, e.key); downloaded++; libSet.add(e.key); }
    catch (err) { failed++; }
  } else already++;
  catalogClient.push({ ...e, cachedPath });
}

mkdirSync(SKILL_DATA, { recursive: true });
writeFileSync(`${SKILL_DATA}/client-photos.json`, JSON.stringify(catalogClient, null, 1));
console.log(`client dishes: ${byKey.size} | downloaded into library: ${downloaded} | already covered: ${already} | failed: ${failed}`);
const provc = {};
for (const r of rows) provc[r.rest] = (provc[r.rest] || 0) + 1;
console.log("item-rows per tenant:", JSON.stringify(provc, null, 0));
