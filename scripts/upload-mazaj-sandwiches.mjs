/**
 * upload-mazaj-sandwiches.mjs
 * Optimize + upload the 5 Mazaj sandwich photos to Supabase Storage at
 * menu-images/<RID>/menu/<slug>.webp. Reads SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('D:\\menulink\\apps\\web\\node_modules\\sharp');
import fs from 'fs';
import path from 'path';

const envPath = String.raw`D:\menulink\apps\web\.env.local`;
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || 'https://dhmjrrsynfvomlzhggvu.supabase.co';
if (!SERVICE) throw new Error('SUPABASE_SERVICE_ROLE_KEY not in .env.local');

const RID = '9f19fe0d-e1fd-482d-a9b1-e3c7ec99ef59';
const BUCKET = 'menu-images';
const SRC = String.raw`C:\Users\USER\OneDrive\Pictures\menulink\mazaj-almosafer`;

const MAP = [
  ['دجاج-السيزر.jpeg', 'ceaser-chicken'],
  ['سندويش-حلومي.jpeg', 'halloumi'],
  ['سندويش-مكسيكان.jpeg', 'mexican'],
  ['شاورما-دجاج.jpeg', 'shawarma-chicken'],
  ['فاهيتا.jpeg', 'fajita'],
];

for (const [file, slug] of MAP) {
  const src = path.join(SRC, file);
  if (!fs.existsSync(src)) { console.log(`MISSING  ${file}`); continue; }
  const buf = await sharp(src).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const storagePath = `${RID}/menu/${slug}.webp`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: buf,
  });
  console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${res.status}  ${String(Math.round(buf.length / 1024)).padStart(3)}KB  -> ${slug}.webp`);
  if (!res.ok) console.log('   ', await res.text());
}
console.log('\nPublic base:', `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${RID}/menu/<slug>.webp`);
