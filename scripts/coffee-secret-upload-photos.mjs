/**
 * coffee-secret-upload-photos.mjs
 *
 * Curated, hand-audited photo map for the Coffee Secret (سر القهوة) tenant.
 * Reads photos from the local ITEMS_PHOTO library (recursive basename match),
 * converts to WebP via sharp, uploads to Supabase Storage, then bulk-updates
 * menu_items.image_url. Cloned from mazaj-upload-photos.mjs.
 *
 * Secrets come from the environment (never hardcoded):
 *   $env:SUPABASE_SERVICE_ROLE_KEY = '<legacy service_role JWT>'
 *   $env:SUPABASE_PAT              = '<supabase personal access token>'
 *
 * Usage:  node scripts/coffee-secret-upload-photos.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const sharp = require("D:\\menulink\\apps\\web\\node_modules\\sharp");
import fs from "fs";
import path from "path";

// ── Config ──────────────────────────────────────────────────────────────────
const RESTAURANT_ID = "ee2a7b70-b661-43cf-aeca-79ff9bd2529a"; // coffee-secret
const SUPABASE_URL = "https://dhmjrrsynfvomlzhggvu.supabase.co";
const PROJECT_REF = "dhmjrrsynfvomlzhggvu";
const BUCKET = "menu-images";
const PHOTO_ROOT = String.raw`D:\menulink\docs\clients\ITEMS_PHOTO`;

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PAT = process.env.SUPABASE_PAT;
if (!SERVICE_ROLE_KEY || !SUPABASE_PAT) {
  throw new Error("Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PAT env vars before running.");
}

const STORAGE_PATH_PREFIX = `${RESTAURANT_ID}/menu`;

// ── Curated library photo → slug(s) map (hand-audited; filenames verified) ────
// chicken casserole.png + the arabic ice-cream-bar file were REJECTED in audit.
const PHOTO_MAP = [
  // ── Hot drinks ──
  ["capachino.jpg", ["cappuccino", "iced-cappuccino"]],
  ["espresso machiatto.jpg", ["macchiato", "double-macchiato"]],
  ["caramel macchiato.jpg", ["caramel-macchiato", "salted-caramel-macchiato", "iced-caramel-macchiato", "iced-salted-caramel-macchiato"]],
  ["espresso.jpg", ["espresso", "ristretto"]],
  ["espresso double.jpg", "double-espresso"],
  ["flat white.jpg", "flat-white"],
  ["french coffee.jpg", "french-coffee"],
  ["latte.jpg", ["latte", "iced-latte"]],
  ["latte with nuts.jpg", "hazelnut-latte"],
  ["hot mocha.jpg", ["mocha", "iced-mocha", "mochaccino", "iced-shaken-mocha-hazelnut", "iced-shaken-white-mocha"]],
  ["mocha with caramel.jpg", "caramel-mocha"],
  ["nirvana.png", "nirvana"],
  ["turkish coffee.jpg", ["turkish-coffee", "double-turkish-coffee", "turkish-milk"]],
  ["toffee frape.jpg", "toffee"],
  ["drip coffee.jpg", ["americano", "iced-americano", "v60"]],
  ["black coffee.jpg", ["black-coffee", "cold-brew", "ice-v60"]],

  // ── Cold drinks (frappuccinos) ──
  ["caramel frape.jpg", ["caramel-frappuccino", "iced-caramel-latte"]],
  ["choclate frape.jpg", ["chocolate-frappuccino", "chocolate-crushed"]],
  ["vanilla frape.jpg", "vanilla-frappuccino"],

  // ── Juices ──
  ["Apple juice.jpg", "apples"],
  ["Orange juice.jpg", "orange"],
  ["Lemon juice.jpg", "lemonade"],
  ["Lemon with mint juice.jpg", "lemon-and-mint"],
  ["Mango with milk juice.jpg", ["mango", "mango-milk-shake"]],
  ["Strawberry with milk juice.jpg", "strawberries"],
  ["avacado vanilla.jpg", ["avocado-milk", "avocado-milk-gishda"]],
  ["Carrot orange and apple juice.jpg", "four-season"],

  // ── Teas & herbs ──
  ["karak.jpg", ["karak-tea", "karak-tea-with-cinger"]],
  ["green tea.jpg", "green-tea"],
  ["green tea mint.jpg", ["green-tea-mint", "tea-and-mint", "hot-mint"]],
  ["red tea mint.jpg", "red-tea"],
  ["green tea lemon.jpg", ["tea-with-lemon", "iced-tea-lemon"]],
  ["ginger tea.jpg", "ginger"],
  ["ginger lemon.jpg", ["ginger-with-lemon", "cinger-lemon-with-honey"]],
  ["ginger milk.jpg", "ginger-milk-honey"],
  ["tea.png", ["tea-milk", "tea-milk-with-cinger", "cinnamon-milk-tea", "kenya-tea", "morocan-tea", "tea-kobus", "thyme", "anise", "carcade", "chamomile-flower", "cumin-and-lemon"]],
  ["Water glass.jpg", "water-1-sr"],

  // ── Milkshakes ──
  ["strawberry frape.jpg", "strawberry-milkshake"],
  ["vanilla frape.jpg", "vanilla-milkshake"], // shared with frappuccino above (uploaded once)
  ["oreo frape.jpg", "oreo-mlkshake"],

  // ── Mojito (all 6 share one mocktail photo) ──
  ["Cocktail.jpg", ["blackberry-mojito", "blueberry-mojito", "fruits-mojito", "pomegranate-mojito", "red-mulberry-mojito", "strawberry-mojito"]],

  // ── Sweet delights ──
  ["lotus cake.jpg", "cake-with-lotus"],
  ["carrot cake.jpg", "carrot-cake"],
  ["cheesecake do leche.jpg", "cheesecake-de-leche"],
  ["cheesecake raspberry.jpg", "cheesecake-raspberry"],
  ["cheesecake strawberry.jpg", "cheesecake-strawberry"],
  ["كيك انجليزي شوكولاته.jpeg", "choco-cake"],
  ["choclate cookies.jpg", "choco-coockies"],
  ["crepe lotus.jpg", "crepe-lotus"],
  ["crepe nutella.jpg", "crepe-nutella"],
  ["crepe pistachio.jpg", "crepe-pistachio"],
  ["crepe chocolate.jpg", "crepe-special"],
  ["custard.jpg", "custard"],
  ["date cake.jpg", "date-cake"],
  ["doughnut choclate.jpg", "donat-shoklit"],
  ["بودينج الشكولاته بالبندق.jpeg", "fondo-galaxy"],
  ["honey cake.jpg", "honey-cake"],
  ["kunafa.jpg", "kunafa"],
  ["molten cake.jpg", "molten-chocolate-cake"],
  ["mhlbia.jpg", "muhallebi"],
  ["pancake lotus.jpg", "pancake-lous"],
  ["pancake nutella.jpg", "pancake-nutella"],
  ["pancake pistacio.jpg", "pancake-pistachio"],
  ["pistachio cake.jpg", "pistachio-cake"],
  ["rice milk.jpg", "rice-with-milk"],
  ["san sabistan.jpg", "san-sebastian"],
  ["soufle.jpg", "souffle"],
  ["tiramisu.jpg", "tiramisu"],
  ["turkish cake.jpg", "turkish-cake"],
  ["white chocolate cake.jpg", "turkish-cake-with-white-chocolate"],
  ["vanilla cookies.jpg", "vanilla-cookies"],
  ["waffle lotus.jpg", ["waffles-lous", "waffles-special"]],
  ["waffle nutella.jpg", "waffles-nutella"],
  ["waffle pistachio.jpg", "waffles-pistachio"],
  ["saffron cake.jpg", "zafron-cake"],

  // ── Salads ──
  ["ceaser salad.jpg", "caesar-salad"],
  ["fatoush salad.png", "fattoush"],
  ["green salad.png", "green-salad"],
  ["taboulah.png", "tabbouleh"],

  // ── Sandwiches ──
  ["beef burger.png", "beef-burger"],
  ["chicken burger.png", ["chicken-burger", "chicken-breast-burger"]],
  ["fajita.jfif", "chicken-fajita"],
  ["awsal chicken.png", "chicken-grilled"],
  ["chicken kbab.png", "chicken-kabab"],
  ["batty kbab meat.png", "lamb-kabab"],
  ["halomy.jfif", "halloumi"],
  ["zinger.jpg", "zinger"],
  ["zinger spicey.jpg", "zinger-spicy"],

  // ── Hot appetizers ──
  ["french fries.png", "french-fries"],

  // ── Platters ──
  ["beshamil pasta.png", "fettuccine-pasta"],

  // ── Shisha (all 30 share one hookah photo) ──
  ["hooka blue.jpg", [
    "glass-lai", "ly-qzaz", "add-customer", "add-elca-girfa", "add-elca-mint",
    "add-faker-head", "add-grape-head", "add-gref-rasbery-head", "add-lemon-mint-head",
    "add-mint-grapes-head", "add-mix-head", "add-mustaka-head", "add-palm-head",
    "add-water-melion-head", "blueberry", "candy", "ealak-mustaka", "ealak-naenae",
    "ealak-qirfa", "faker", "grape", "grape-rasbery", "lemon-mint", "max-mazaya",
    "mint-grapes", "mix", "palm", "salum", "salum-shisha", "water-melon",
  ]],
];

// ── Build recursive basename → fullpath index (case-insensitive) ─────────────
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
const fileIndex = new Map();
for (const f of walk(PHOTO_ROOT)) fileIndex.set(path.basename(f).toLowerCase(), f);
function resolveFile(name) {
  return fileIndex.get(name.toLowerCase()) ?? null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function convertToWebp(srcPath) {
  return sharp(srcPath).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}
async function uploadToStorage(buffer, storagePath) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      "Content-Type": "image/webp",
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}
async function runSQL(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_PAT}`, "Content-Type": "application/json", "User-Agent": "menulink-cli/1.0" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const workItems = [];
  const missing = [];
  for (const [photoFile, slugOrSlugs] of PHOTO_MAP) {
    const slugs = Array.isArray(slugOrSlugs) ? slugOrSlugs : [slugOrSlugs];
    const srcPath = resolveFile(photoFile);
    if (!srcPath) { missing.push(photoFile); continue; }
    for (const slug of slugs) workItems.push({ slug, photoFile, srcPath });
  }
  if (missing.length) console.warn("MISSING FILES:", missing);
  console.log(`Work items: ${workItems.length} (unique photos: ${new Set(workItems.map((w) => w.photoFile)).size})`);

  // Phase 1: upload each unique photo once (to <firstSlug>.webp)
  const uploadedPhotos = new Map();
  let ok = 0, fail = 0;
  for (const photoFile of [...new Set(workItems.map((w) => w.photoFile))]) {
    const w = workItems.find((x) => x.photoFile === photoFile);
    const storagePath = `${STORAGE_PATH_PREFIX}/${w.slug}.webp`;
    try {
      const buf = await convertToWebp(w.srcPath);
      const publicUrl = await uploadToStorage(buf, storagePath);
      uploadedPhotos.set(photoFile, publicUrl);
      ok++;
      console.log(`  OK  ${photoFile} -> ${w.slug}.webp (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (err) { fail++; console.error(`  FAIL ${photoFile}: ${err.message}`); }
  }
  console.log(`\nUploads: ${ok} OK, ${fail} failed`);

  // Phase 2: bulk UPDATE image_url via CASE
  const caseLines = [], slugList = [];
  for (const item of workItems) {
    const u = uploadedPhotos.get(item.photoFile);
    if (!u) continue;
    caseLines.push(`WHEN '${item.slug.replace(/'/g, "''")}' THEN '${u.replace(/'/g, "''")}'`);
    slugList.push(`'${item.slug.replace(/'/g, "''")}'`);
  }
  if (!caseLines.length) { console.log("nothing to update"); return; }
  const sql = `UPDATE menu_items SET image_url = CASE slug\n  ${caseLines.join("\n  ")}\nEND\nWHERE restaurant_id = '${RESTAURANT_ID}' AND slug IN (${slugList.join(", ")});`;
  console.log(`\nUpdating ${slugList.length} items...`);
  console.log("DB result:", JSON.stringify(await runSQL(sql)));

  const cov = await runSQL(`SELECT count(*) FILTER (WHERE image_url IS NOT NULL) AS with_photo, count(*) AS total FROM menu_items WHERE restaurant_id = '${RESTAURANT_ID}'`);
  console.log("Coverage:", JSON.stringify(cov));
  console.log("Done.");
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
