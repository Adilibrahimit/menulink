// Build the dish dictionary from every live tenant's menu_items.
// Output: <skill>/data/dish-dictionary.json — the canonical AR+EN+category vocabulary
// used to label library files and to key the photo catalog.
import { mkdirSync, writeFileSync } from "node:fs";
import { sql, slugify, canonicalCategory, TENANTS, SKILL_DATA } from "./lib.mjs";

const tenantList = Object.keys(TENANTS).map((s) => `'${s}'`).join(", ");
const rows = await sql(`
  select r.slug rest, i.slug, i.name_ar, i.name_en, c.slug cat_slug, c.name_ar cat_ar
  from menu_items i
  join restaurants r on r.id = i.restaurant_id
  join menu_categories c on c.id = i.category_id
  where r.slug in (${tenantList})
  order by r.slug, c.sort, i.sort
`);

// Merge into dish concepts. Key by EN slug when present, else the item slug.
const byKey = new Map();
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
function keyFor(r) {
  const en = norm(r.name_en);
  if (en) return slugify(en);
  return r.slug; // fall back to the per-tenant slug
}
for (const r of rows) {
  const key = keyFor(r);
  if (!key) continue;
  const category = canonicalCategory(r.cat_slug, r.cat_ar, r.name_en, r.name_ar);
  let e = byKey.get(key);
  if (!e) {
    e = { key, name_ar: norm(r.name_ar), name_en: norm(r.name_en), category, slugs: new Set(), names_ar: new Set(), tenants: new Set() };
    byKey.set(key, e);
  }
  if (!e.name_en && norm(r.name_en)) e.name_en = norm(r.name_en);
  e.slugs.add(r.slug);
  if (norm(r.name_ar)) e.names_ar.add(norm(r.name_ar));
  e.tenants.add(r.rest);
}

const dict = [...byKey.values()]
  .map((e) => ({
    key: e.key,
    name_ar: e.name_ar,
    name_en: e.name_en,
    category: e.category,
    slugs: [...e.slugs],
    names_ar: [...e.names_ar],
    tenants: [...e.tenants],
  }))
  .sort((a, b) => (a.category + a.key).localeCompare(b.category + b.key));

mkdirSync(SKILL_DATA, { recursive: true });
writeFileSync(`${SKILL_DATA}/dish-dictionary.json`, JSON.stringify(dict, null, 1));

const byCat = {};
for (const d of dict) byCat[d.category] = (byCat[d.category] || 0) + 1;
console.log(`dish dictionary: ${dict.length} dish concepts from ${rows.length} item-rows across ${Object.keys(TENANTS).length} tenants`);
console.log("by category:", JSON.stringify(byCat, null, 0));
