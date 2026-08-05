// Does the service worker ACTUALLY cache menu photos?
//
// Keep this. tsc and `next build` cannot answer the question: the previous
// version of sw.js compiled clean, built clean, and cached exactly ZERO images,
// because `<img>` issues no-cors requests whose responses are opaque
// (`ok === false`) and were silently dropped by an `ok` check. Only a real
// browser tells "caching" apart from "code that looks like caching".
//
// Run:
//   npx next build && npx next start -p 3210
//   node .sw-verify.mjs
//
// Expect: photos-in-cache > 0. Measured 2026-08-05 — 0 before the fix, 64 after.
// The cache COUNT is the discriminating number; "no requests on reload" is not,
// because the browser's own HTTP cache produces that result either way.
//
// Needs Edge or Chrome installed (PW_CHANNEL, default msedge) — Playwright's
// bundled Chromium is not downloaded in this repo.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3210';
const SLUG = process.env.SLUG || 'rzrz-bukhari-test';
const URL_ = `${BASE}/m/${SLUG}`;

const isPhoto = (u) =>
  u.includes('/storage/v1/') &&
  (u.includes('/object/public/') || u.includes('/render/image/public/'));

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// Seed the guest identity so the login gate never intercepts. Clicking
// through it was flaky and it is not what these tests are measuring.
await ctx.addInitScript(() => {
  localStorage.setItem('menulink:guest', JSON.stringify({ phone: '966501234567', name: 'SW Test' }));
});
const page = await ctx.newPage();

async function passLoginGate(p) {
  const guest = p.getByText('متابعة كزائر', { exact: false });
  if (await guest.count()) {
    await guest.first().click();
    await p.waitForTimeout(500);
    const phone = p.locator('input[type="tel"]');
    if (await phone.count()) {
      await phone.first().fill('501234567');
      await p.getByRole('button', { name: 'متابعة', exact: true }).click().catch(() => {});
      await p.waitForTimeout(1500);
    }
  }
  // google-first tenants then ask for an order type
  const pickup = p.getByText('استلام', { exact: false });
  if (await pickup.count()) {
    await pickup.first().click().catch(() => {});
    await p.waitForTimeout(1200);
  }
}

async function scrollAll(p, rounds = 14) {
  for (let i = 0; i < rounds; i++) {
    await p.mouse.wheel(0, 1400);
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(2500);
}

console.log('→ first load', URL_);
await page.goto(URL_, { waitUntil: 'networkidle', timeout: 60000 });
await passLoginGate(page);

await page
  .waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30000 })
  .then(() => console.log('   SW is controlling the page'))
  .catch(() => console.log('   !! no SW controller'));

let firstPass = 0;
const onReq = (r) => { if (isPhoto(r.url())) firstPass++; };
page.on('request', onReq);
await scrollAll(page);
page.off('request', onReq);

const state = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = {};
  for (const n of names) {
    const keys = await (await caches.open(n)).keys();
    out[n] = keys.filter((r) => r.url.includes('/storage/v1/')).length;
  }
  return out;
});
console.log('photos in cache after pass 1:', JSON.stringify(state));
console.log('photo network requests, pass 1:', firstPass);

// --- pass 2: same page, warm cache. Cached photos must not touch the network.
let secondPass = 0;
const onReq2 = (r) => { if (isPhoto(r.url())) secondPass++; };
console.log('→ reload with warm cache');
await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
await passLoginGate(page);
page.on('request', onReq2);
await scrollAll(page);
page.off('request', onReq2);

console.log('photo network requests, pass 2:', secondPass);

const cached = Object.values(state).reduce((a, b) => a + b, 0);
const pass = cached > 0 && firstPass > 0 && secondPass <= Math.max(1, Math.floor(firstPass * 0.15));
console.log(
  '\nRESULT:',
  pass
    ? `PASS — ${cached} photos cached; re-scroll refetched ${secondPass} of ${firstPass}`
    : `FAIL — cached=${cached}, pass1=${firstPass}, pass2=${secondPass}`,
);

await browser.close();
process.exit(pass ? 0 : 1);
