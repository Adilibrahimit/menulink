/**
 * fetch-commons.mjs — download freely-licensed image candidates from Wikimedia Commons.
 * Usage: node scripts/fetch-commons.mjs "search terms" <outDir> <count>
 * Prints index, license, title, file for each downloaded candidate.
 */
import fs from 'fs';
import path from 'path';

const q = process.argv[2] || 'dallah arabic coffee';
const out = process.argv[3] || 'D:/menulink/docs/clients-menu/almosafer/new-photos/commons';
const n = parseInt(process.argv[4] || '12', 10);

const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
  + `&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=${n}`
  + `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&origin=*`;

const res = await fetch(api, { headers: { 'User-Agent': 'menulink-tooling/1.0 (restaurant menu photo sourcing)' } });
const data = await res.json();
const pages = data?.query?.pages || {};
fs.mkdirSync(out, { recursive: true });
let i = 0;
for (const k in pages) {
  const p = pages[k];
  const ii = p.imageinfo?.[0];
  if (!ii) continue;
  const url = ii.thumburl || ii.url;
  if (/\.svg$/i.test(url)) continue; // skip vector icons
  const license = ii.extmetadata?.LicenseShortName?.value || '?';
  const artist = (ii.extmetadata?.Artist?.value || '').replace(/<[^>]+>/g, '').slice(0, 40);
  i++;
  try {
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': 'menulink-tooling/1.0' } })).arrayBuffer());
    const fn = path.join(out, `commons_${i}.jpg`);
    fs.writeFileSync(fn, buf);
    console.log(`${i}\t[${license}]\t${p.title.replace('File:', '')}\tby ${artist}`);
  } catch (e) { console.log(`${i} download failed: ${e.message}`); }
}
console.log(`\nSaved ${i} candidates to ${out}`);
