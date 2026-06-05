/**
 * fetch-unsplash-candidates.mjs
 * Downloads N Unsplash candidates for a query into a folder for visual review.
 * Reads UNSPLASH_ACCESS_KEY from apps/web/.env.local (never printed).
 *
 * Usage: node scripts/fetch-unsplash-candidates.mjs "mango juice" <outDir> <count>
 */
import fs from 'fs';
import path from 'path';

const envPath = String.raw`D:\menulink\apps\web\.env.local`;
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const KEY = env.UNSPLASH_ACCESS_KEY;
if (!KEY) throw new Error('UNSPLASH_ACCESS_KEY not found in .env.local');

const query = process.argv[2] || 'mango juice';
const outDir = process.argv[3] || String.raw`D:\menulink\docs\clients-menu\almosafer\new-photos`;
const n = parseInt(process.argv[4] || '8', 10);

const res = await fetch(
  `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${n}&orientation=squarish&content_filter=high&client_id=${KEY}`
);
const data = await res.json();
if (!data.results || !data.results.length) { console.error('No results:', JSON.stringify(data).slice(0, 300)); process.exit(1); }

fs.mkdirSync(outDir, {recursive: true});
const slug = query.replace(/\s+/g, '-');
let i = 0;
for (const ph of data.results) {
  i++;
  const buf = Buffer.from(await (await fetch(ph.urls.regular)).arrayBuffer());
  const fn = path.join(outDir, `cand_${slug}_${i}.jpg`);
  fs.writeFileSync(fn, buf);
  console.log(`${i}\t${path.basename(fn)}\t${ph.width}x${ph.height}\tby ${ph.user.name}\t${(ph.description || ph.alt_description || '').slice(0, 60)}`);
}
console.log(`\nSaved ${i} candidates to ${outDir}`);
