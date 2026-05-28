/**
 * mazaj-upload-photos.mjs
 *
 * Reads photos from the library, converts to WebP via sharp,
 * uploads to Supabase Storage, then bulk-updates menu_items.image_url.
 *
 * Usage:
 *   node scripts/mazaj-upload-photos.mjs          # full run
 *   node scripts/mazaj-upload-photos.mjs --test    # single item test (cappuccino)
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// sharp is installed in apps/web — resolve from there
const sharp = require('D:\\menulink\\apps\\web\\node_modules\\sharp');
import fs from 'fs';
import path from 'path';

// ── Config ──────────────────────────────────────────────────────────────────
const RESTAURANT_ID = '9f19fe0d-e1fd-482d-a9b1-e3c7ec99ef59';
const SUPABASE_URL = 'https://dhmjrrsynfvomlzhggvu.supabase.co';
// Secrets come from the environment — never hardcode.
//   $env:SUPABASE_SERVICE_ROLE_KEY = '...'  ;  $env:SUPABASE_PAT = '...'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_PAT = process.env.SUPABASE_PAT;
if (!SERVICE_ROLE_KEY || !SUPABASE_PAT) {
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PAT env vars before running.');
}
const PROJECT_REF = 'dhmjrrsynfvomlzhggvu';
const BUCKET = 'menu-images';
const PHOTO_DIR = String.raw`D:\menulink\docs\clients-menu\ITEMS_PHOTO\OneDrive_2026-05-25\Menu Pics`;

const STORAGE_PATH_PREFIX = `${RESTAURANT_ID}/menu`;
const PUBLIC_URL_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${STORAGE_PATH_PREFIX}`;

const TEST_MODE = process.argv.includes('--test');

// ── Explicit photo → slug mapping ───────────────────────────────────────────
// Each entry: [photoFilename, slug(s)]
// Where slug(s) is a string or array of strings (for reusing one photo across items)

const PHOTO_MAP = [
  // ── Hot drinks ──
  ['capachino.jpg', 'cappuccino'],
  ['cortado coffe.jpg', 'cortado'],
  ['latte.jpg', 'latte'],
  ['flat white.jpg', 'flat-white'],
  ['espresso.jpg', 'espresso-single'],
  ['espresso double.jpg', 'espresso-double'],
  ['green tea.jpg', 'green-tea'],
  ['ginger tea.jpg', 'ginger-tea'],
  ['turkish coffee.jpg', 'turkish-coffee'],
  ['hot mocha.jpg', 'white-mocha'],
  ['drip coffee.jpg', 'coffee-day'],
  ['caramel macchiato.jpg', 'signature-49'],
  ['espresso machiatto.jpg', 'pestachio'],
  ['chocalate cappuccino.jpg', 'hot-chocolate'],

  // ── Cold drinks ──
  ['black coffee.jpg', 'iced-americano'],
  ['caramel frape.jpg', 'iced-latte'],
  ['mocha frape.jpg', 'iced-mocha'],
  ['latte with nuts.jpg', 'pistachio-latte'],

  // ── Teas ──
  ['green tea mint.jpg', 'tea-pot-green'],
  ['red tea mint.jpg', 'red-tea'],
  ['english tea.jpg', 'mint-tea'],
  ['karak.jpg', 'tea-pot-red'],
  ['ginger lemon.jpg', 'taifi'],

  // ── V60/Chemex ──
  // No exact match — skip v60, chemex, iced-v60

  // ── Spanish latte ──
  ['french coffee.jpg', 'spanish-latte'],
  ['italian coffee.jpg', 'iced-spanish-latte'],
  ['rice milk.jpg', 'iced-v60'],

  // ── Juices ──
  ['Orange juice.jpg', 'asyr-brtqal'],
  ['Lemon with mint juice.jpg', 'asyr-lymwn-nanaa'],
  ['Apple juice.jpg', 'asyr-tbyay-20'],

  // ── Bottled drinks (no exact matches for most) ──
  // Pepsi, Sprite, 7UP etc. are branded — library doesn't have product shots
  // Skip: pepsi, sprite, 7-up, 7-up-diet, cola-diet, code-red,
  //        sparkling-water, red-bull, orange-miranda, all houlsten-*,
  //        ice-tea-mix, peach-iced-tea
  ['Water glass.jpg', 'plain-water'],

  // ── Desserts ──
  ['choclate cake.jpg', 'chocolate-cake'],
  ['tiramisu.jpg', 'tramysw'],
  ['pistachio cake.jpg', 'pistachio-cake'],
  ['pistachio cakee.jpg', 'kyka-asl'],
  ['san sabistan cheesecake.jpg', 'san-sabastian'],
  ['san sabistan.jpg', 'san-sbastyan'],
  ['cheesecake strawberry.jpg', 'cheesecake'],
  ['Red velvet cheesecake .jpg', 'red-velvet'],
  ['lotus cheese cake.jpg', 'basbousa'],
  ['crunchie choclate.jpg', 'kranshy-shwklyt'],
  ['molten cake.jpg', 'lafa-mwltn-kyk'],
  ['honey cake.jpg', 'kyk-kramyl'],
  ['carrot cake.jpg', 'kyka-allymwn'],
  ['lotus cake.jpg', 'layrz-kyk'],
  ['choclate cookies.jpg', 'bwdq-shwklyt'],
  ['custard.jpg', 'bwdynj-alshwkwlath-balbndq'],
  ['black forest cake.jpg', 'awlkr-kyk'],
  ['rockslide brownie.jpg', 'kranshy-shwklyt-rwz-byry'],
  ['kunafa.jpg', 'bsbwsa'],
  ['date cake.jpg', 'klawdy-kyk'],
  ['saffron cake.jpg', 'kyka-marbl'],

  // ── Sandwiches ──
  ['ceaser salad.jpg', 'ceaser-chicken'],
  // fajita, halloumi, mexican, shawarma — no good match in library

  // ── Mojitos (all 40 share one photo) ──
  ['Cocktail.jpg', [
    'mojito-7up-blackberry', 'mojito-7up-blueberry', 'mojito-7up-lemon',
    'mojito-7up-mixed-berry', 'mojito-7up-passion-fruit', 'mojito-7up-peach',
    'mojito-7up-pomegranate', 'mojito-7up-raspberry', 'mojito-7up-strawberry',
    'mojito-7up-watermelon',
    'mojito-sprite-blackberry', 'mojito-sprite-blueberry', 'mojito-sprite-lemon',
    'mojito-sprite-mixed-berry', 'mojito-sprite-passion-fruit', 'mojito-sprite-peach',
    'mojito-sprite-pomegranate', 'mojito-sprite-raspberry', 'mojito-sprite-strawberry',
    'mojito-sprite-watermelon',
    'mojito-code-red-blackberry', 'mojito-code-red-blueberry', 'mojito-code-red-lemon',
    'mojito-code-red-mixed-berry', 'mojito-code-red-passion-fruit', 'mojito-code-red-peach',
    'mojito-code-red-pomegranate', 'mojito-code-red-raspberry', 'mojito-code-red-strawberry',
    'mojito-code-red-watermelon',
    'mojito-red-bull-blackberry', 'mojito-red-bull-blueberry', 'mojito-red-bull-lemon',
    'mojito-red-bull-mixed-berry', 'mojito-red-bull-passion-fruit', 'mojito-red-bull-peach',
    'mojito-red-bull-pomegranate', 'mojito-red-bull-raspberry', 'mojito-red-bull-strawberry',
    'mojito-red-bull-watermelon',
  ]],

  // ── Shisha — use hookah photo for all AM/PM/39 variants ──
  ['hooka blue.jpg', [
    // AM
    'almosfaer-mix', 'candy', 'double-apple-premium', 'double-apples-palm',
    'gum-premium', 'mazaya-cinnamon-gum', 'melon-mzaya',
    'premium-blueberry', 'premium-grape-berry', 'premium-grape-mint',
    'premium-grape', 'premium-lemon-mint', 'premium-mint',
    'premium-musk-gum', 'premium-watermelon', 'ruby-crush',
    'shisha-3', 'shisha-49', 'strawberry-premium', 'watermelon-mint-premium',
    // PM
    'almosfaer-mix-shisha-pm', 'candy-shisha-pm', 'double-apple-premium-shisha-pm',
    'double-apples-palm-shisha-pm', 'gum-premium-shisha-pm',
    'mazaya-cinnamon-gum-shisha-pm', 'melon-mzaya-shisha-pm',
    'premium-blueberry-shisha-pm', 'premium-grape-berry-shisha-pm',
    'premium-grape-mint-shisha-pm', 'premium-grape-shisha-pm',
    'premium-lemon-mint-shisha-pm', 'premium-mint-shisha-pm',
    'premium-musk-gum-shisha-pm', 'premium-watermelon-shisha-pm',
    'ruby-crush-shisha-pm', 'strawberry-premium-shisha-pm',
    'watermelon-mint-premium-shisha-pm',
    // 39 (renewal)
    'almosfaer-mix-shisha-39', 'candy-shisha-39', 'double-apple-premium-shisha-39',
    'double-apples-palm-shisha-39', 'gum-premium-shisha-39',
    'mazaya-cinnamon-gum-shisha-39', 'melon-mzaya-shisha-39',
    'premium-blueberry-shisha-39', 'premium-grape-berry-shisha-39',
    'premium-grape-mint-shisha-39', 'premium-grape-shisha-39',
    'premium-lemon-mint-shisha-39', 'premium-mint-shisha-39',
    'premium-musk-gum-shisha-39', 'premium-watermelon-shisha-39',
    'ruby-crush-shisha-39', 'strawberry-premium-shisha-39',
    'watermelon-mint-premium-shisha-39',
  ]],
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function convertToWebp(srcPath) {
  return sharp(srcPath)
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

async function uploadToStorage(buffer, storagePath) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${text}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function runSQL(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(TEST_MODE ? '=== TEST MODE (cappuccino only) ===' : '=== FULL RUN ===');

  // Build work list: { slug, photoFile, storagePath, publicUrl }
  const workItems = [];
  // Track which photos we've already uploaded to avoid duplicate uploads
  const uploadedPhotos = new Map(); // photoFile -> publicUrl of the uploaded webp

  for (const [photoFile, slugOrSlugs] of PHOTO_MAP) {
    const slugs = Array.isArray(slugOrSlugs) ? slugOrSlugs : [slugOrSlugs];
    const srcPath = path.join(PHOTO_DIR, photoFile);

    if (!fs.existsSync(srcPath)) {
      console.warn(`  SKIP (file missing): ${photoFile}`);
      continue;
    }

    for (const slug of slugs) {
      workItems.push({ slug, photoFile, srcPath });
    }
  }

  if (TEST_MODE) {
    // Only keep cappuccino
    const testItem = workItems.find(w => w.slug === 'cappuccino');
    if (!testItem) { console.error('cappuccino not in work list'); process.exit(1); }
    workItems.length = 0;
    workItems.push(testItem);
  }

  console.log(`\nTotal items to process: ${workItems.length}`);

  // Phase 1: Upload unique photos
  const uniquePhotos = [...new Set(workItems.map(w => w.photoFile))];
  console.log(`Unique photos to upload: ${uniquePhotos.length}\n`);

  let uploadOk = 0, uploadFail = 0;
  for (const photoFile of uniquePhotos) {
    const srcPath = path.join(PHOTO_DIR, photoFile);
    // For shared photos (Cocktail.jpg for 40 mojitos), upload once as a generic name
    // Determine the upload slug: use first slug that uses this photo
    const firstSlug = workItems.find(w => w.photoFile === photoFile).slug;
    const storagePath = `${STORAGE_PATH_PREFIX}/${firstSlug}.webp`;

    try {
      const buffer = await convertToWebp(srcPath);
      const publicUrl = await uploadToStorage(buffer, storagePath);
      uploadedPhotos.set(photoFile, publicUrl);
      uploadOk++;
      console.log(`  OK  ${photoFile} -> ${storagePath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      uploadFail++;
      console.error(`  FAIL ${photoFile}: ${err.message}`);
    }
  }

  console.log(`\nUploads: ${uploadOk} OK, ${uploadFail} failed`);

  // Phase 2: Build CASE statement and update DB
  const caseLines = [];
  const slugList = [];

  for (const item of workItems) {
    const publicUrl = uploadedPhotos.get(item.photoFile);
    if (!publicUrl) continue; // photo upload failed

    // For shared photos, all slugs point to the same URL
    const escapedUrl = publicUrl.replace(/'/g, "''");
    const escapedSlug = item.slug.replace(/'/g, "''");
    caseLines.push(`WHEN '${escapedSlug}' THEN '${escapedUrl}'`);
    slugList.push(`'${escapedSlug}'`);
  }

  if (caseLines.length === 0) {
    console.log('No successful uploads — nothing to update in DB.');
    return;
  }

  const sql = `UPDATE menu_items SET image_url = CASE slug\n  ${caseLines.join('\n  ')}\nEND\nWHERE restaurant_id = '${RESTAURANT_ID}' AND slug IN (${slugList.join(', ')});`;

  console.log(`\nUpdating ${slugList.length} menu items in DB...`);

  try {
    const result = await runSQL(sql);
    console.log('DB update result:', JSON.stringify(result));
  } catch (err) {
    console.error('DB update failed:', err.message);
    // Dump SQL for manual recovery
    fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.substring(1)), 'mazaj-update.sql'), sql);
    console.log('SQL saved to scripts/mazaj-update.sql for manual execution');
  }

  // Phase 3: Verify a sample
  const sampleSlug = workItems[0]?.slug;
  if (sampleSlug) {
    const verifyResult = await runSQL(
      `SELECT slug, image_url FROM menu_items WHERE restaurant_id = '${RESTAURANT_ID}' AND slug = '${sampleSlug}'`
    );
    console.log(`\nVerification (${sampleSlug}):`, JSON.stringify(verifyResult));
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
