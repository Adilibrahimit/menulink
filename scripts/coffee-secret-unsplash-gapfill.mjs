/**
 * coffee-secret-unsplash-gapfill.mjs
 *
 * Fills menu_items with no photo (image_url IS NULL) using the top Unsplash
 * result for a curated per-item query. Idempotent + resumable: only touches
 * items that are still NULL and have a query below. Branded sodas + utility
 * items are intentionally omitted (they keep the themed gold-cup SVG fallback).
 *
 * Env: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PAT, UNSPLASH_ACCESS_KEY
 * Usage: node scripts/coffee-secret-unsplash-gapfill.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sharp = require("D:\\menulink\\apps\\web\\node_modules\\sharp");

const RESTAURANT_ID = "ee2a7b70-b661-43cf-aeca-79ff9bd2529a";
const SUPABASE_URL = "https://dhmjrrsynfvomlzhggvu.supabase.co";
const PROJECT_REF = "dhmjrrsynfvomlzhggvu";
const BUCKET = "menu-images";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PAT = process.env.SUPABASE_PAT;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!SERVICE_ROLE_KEY || !SUPABASE_PAT || !UNSPLASH_KEY) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PAT, UNSPLASH_ACCESS_KEY");
const STORAGE_PREFIX = `${RESTAURANT_ID}/menu`;

// slug -> Unsplash search query (halal-safe food/drink terms only)
const QUERY = {
  // hot drinks
  "spanish-latte": "spanish latte coffee", "pistachio-latte": "pistachio latte coffee",
  "red-velvet-latte": "red velvet latte", "caramel-latte": "caramel coffee cup latte art",
  "hot-chocolate": "hot chocolate drink mug", "nescafe": "coffee with milk mug",
  "cinnamon-milk": "cinnamon milk drink", "americano-with-milk": "americano coffee milk",
  // cold drinks (non-branded only)
  "iced-spanish-latte": "iced spanish latte", "iced-pistachio-latte": "pistachio iced coffee",
  "iced-red-velvet-latte": "iced red velvet latte", "iced-americano-wl-milk": "iced coffee milk",
  "ice-carcade": "iced hibiscus tea",
  // juices
  carrots: "carrot juice glass", kiwi: "kiwi juice glass", pineapple: "pineapple juice glass",
  watermelon: "watermelon juice glass", "banana-milk": "banana milk drink glass",
  "mix-berry": "mixed berry juice", "mix-fruit": "mixed fruit juice cocktail",
  fakhfakhina: "layered fruit cocktail dessert", "awar-qalp": "layered fruit milkshake glass",
  "smoothy-blueberry": "blueberry smoothie", "smoothy-mango": "mango smoothie",
  "smoothy-passion-fruit": "passion fruit smoothie", "smoothy-strawberry": "strawberry smoothie",
  "yogurt-with-honey": "yogurt honey drink",
  // milkshakes
  "banana-milkshake": "banana milkshake glass", "chocolate-mlkshake": "chocolate milkshake glass",
  "snickers-milkshake": "chocolate caramel milkshake",
  // iced tea
  "iced-tea-fruit": "fruit iced tea glass", "iced-tea-lemon-and-mint": "lemon mint iced tea",
  "iced-tea-peach": "peach iced tea glass", "iced-tea-raspberry": "raspberry iced tea",
  // tea / sweets
  sahlab: "warm milk drink cinnamon nuts", "cheesecake-oreo": "oreo cookies cream cheesecake",
  // ice cream
  "arabic-ice-cream": "arabic pistachio ice cream booza", "banana-ice-cream": "banana ice cream scoop",
  "berry-ice-cream": "berry ice cream scoop", "cherry-ice-cream": "cherry ice cream scoop",
  "chocolamou-ice-cream": "chocolate ice cream scoops", "chocolate-ice-cream": "chocolate ice cream scoop",
  "hazelnut-ice-cream": "hazelnut ice cream scoop", "lemon-ice-cream": "lemon ice cream scoop",
  "mango-ice-cream": "mango ice cream scoop", "mastic-and-cream-ice-cream": "white vanilla ice cream scoop",
  "oreo-ice-cream": "oreo ice cream scoop", "strawberry-ice-cream": "strawberry ice cream scoop",
  // fruit salads
  "azaan-avocado-special": "avocado fruit cream dessert", "azan-emperor": "fruit salad cream dessert cup",
  "cream-honey-and-nuts": "fruit cream nuts dessert", "crunch-salad": "fruit salad dessert cup",
  "drink-dessert": "dessert cup with drink", "ice-cream-with-fruits": "fruit salad ice cream",
  "march-fruit-salad": "fresh fruit salad bowl", "nutella-fruit-cream": "fruit nutella cream dessert",
  "nutella-salad": "fruit salad nutella", "oreo-fruit-salad": "fruit salad oreo cream",
  "shami-fruit-salad": "fruit cream dessert cup", shuklamo: "chocolate fruit dessert cup",
  "tutti-frutti": "tutti frutti fruit salad", "twix-salad": "chocolate fruit salad dessert",
  "special-fruit-salad": "fresh fruit salad bowl cream",
  // sandwiches
  "beef-steak": "steak sandwich", "chicken-mexicano": "mexican chicken sandwich",
  "chicken-quesadillas": "chicken quesadilla", "chicken-shawarma": "chicken shawarma sandwich wrap",
  "chicken-wrap": "chicken wrap sandwich", meal: "sandwich meal combo plate", potatoes: "potato sandwich",
  // hot appetizers
  "cheese-kibbeh": "fried cheese kibbeh", "cheese-spring-roll": "cheese spring rolls fried",
  "chicken-dynamite": "dynamite chicken appetizer", "chicken-kibbeh": "fried kibbeh",
  "chicken-nuggets": "chicken nuggets plate", "meat-kibbeh": "fried meat kibbeh",
  "potato-dynamite": "spicy fried potato", "shrimp-dynamite": "dynamite shrimp",
  snack: "appetizer snack platter", "spicy-potato-cubes": "spicy potato cubes fried",
  "steak-mozzarella": "fried mozzarella sticks",
  // platters
  "chicken-with-cream": "creamy chicken skillet", "dj-chicken": "grilled chicken platter",
};

async function runSQL(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_PAT}`, "Content-Type": "application/json", "User-Agent": "menulink-cli/1.0" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${await res.text()}`);
  return res.json();
}
async function unsplashTop(q) {
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=squarish&content_filter=high`, {
    headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
  });
  if (res.status === 403) throw new Error("RATE_LIMIT");
  if (!res.ok) throw new Error(`unsplash ${res.status}`);
  const j = await res.json();
  return j.results?.[0]?.urls?.regular ?? null;
}
async function toWebp(url) {
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  return sharp(buf).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}
async function upload(buf, slug) {
  const sp = `${STORAGE_PREFIX}/${slug}.webp`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${sp}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "image/webp", "x-upsert": "true" },
    body: buf,
  });
  if (!res.ok) throw new Error(`storage ${res.status}: ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${sp}`;
}

async function main() {
  const nullRows = await runSQL(`SELECT slug FROM menu_items WHERE restaurant_id='${RESTAURANT_ID}' AND image_url IS NULL`);
  const nullSet = new Set(nullRows.map((r) => r.slug));
  const todo = Object.keys(QUERY).filter((s) => nullSet.has(s));
  console.log(`NULL items: ${nullSet.size} | have query: ${todo.length} | will fill now`);
  const done = [];
  let rateLimited = false;
  for (const slug of todo) {
    try {
      const url = await unsplashTop(QUERY[slug]);
      if (!url) { console.warn(`  no result: ${slug} ("${QUERY[slug]}")`); continue; }
      const buf = await toWebp(url);
      const pub = await upload(buf, slug);
      done.push({ slug, pub });
      console.log(`  OK ${slug} <- "${QUERY[slug]}" (${(buf.length / 1024).toFixed(0)}KB)`);
    } catch (e) {
      if (e.message === "RATE_LIMIT") { console.error("  RATE LIMIT hit — stopping; re-run later to resume."); rateLimited = true; break; }
      console.error(`  FAIL ${slug}: ${e.message}`);
    }
  }
  if (done.length) {
    const cases = done.map((d) => `WHEN '${d.slug.replace(/'/g, "''")}' THEN '${d.pub.replace(/'/g, "''")}'`).join("\n  ");
    const slugs = done.map((d) => `'${d.slug.replace(/'/g, "''")}'`).join(", ");
    await runSQL(`UPDATE menu_items SET image_url = CASE slug\n  ${cases}\nEND\nWHERE restaurant_id='${RESTAURANT_ID}' AND slug IN (${slugs});`);
    console.log(`\nUpdated ${done.length} items.`);
  }
  const cov = await runSQL(`SELECT count(*) FILTER (WHERE image_url IS NOT NULL) with_photo, count(*) total FROM menu_items WHERE restaurant_id='${RESTAURANT_ID}'`);
  console.log("Coverage:", JSON.stringify(cov), rateLimited ? "(rate-limited; re-run to continue)" : "");
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
