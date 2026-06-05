/**
 * preview-mazaj.mjs — screenshot the local Mazaj menu (enlarged images) for review.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('D:\\menulink\\apps\\web\\node_modules\\playwright');

const URL = process.argv[2] || 'http://localhost:3100/m/mazaj-almosafer';
const PREFIX = process.argv[3] || 'preview';
const OUT = 'D:\\menulink\\docs\\clients-menu\\almosafer\\new-photos';

let browser;
for (const opts of [{ channel: 'chrome' }, {}]) {
  try { browser = await chromium.launch(opts); break; } catch (e) { console.log('launch failed', opts, e.message); }
}
if (!browser) { console.log('NO_BROWSER'); process.exit(1); }

const ctx = await browser.newContext({ viewport: { width: 430, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });

// Scroll through the whole page slowly to trigger every lazy-loaded image
await page.evaluate(async () => {
  await new Promise((res) => {
    let y = 0; const step = 350;
    const t = setInterval(() => {
      window.scrollTo(0, y); y += step;
      if (y > document.body.scrollHeight) { clearInterval(t); res(); }
    }, 90);
  });
});
// Wait until all <img> have actually decoded (naturalWidth>0), or 20s
await page.waitForFunction(() => {
  const imgs = [...document.querySelectorAll('img')];
  return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
}, { timeout: 20000 }).catch(() => console.log('(some imgs not loaded — proceeding)'));
await page.waitForTimeout(800);

// Shot: hot drinks — shows قهوة سعودية rename + SAR symbol on prices
try {
  await page.getByRole('button', { name: 'المشروبات الساخنة', exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollBy(0, 110));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}\\${PREFIX}_hot.png` });
  console.log('hot shot OK');
} catch (e) { console.log('hot nav failed:', e.message); }

// Shot: desserts (حلى)
try {
  await page.getByRole('button', { name: 'حلى', exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollBy(0, 110));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}\\${PREFIX}_sweets.png` });
  console.log('sweets shot OK');
} catch (e) { console.log('sweets nav failed:', e.message); }

// Shot: sandwiches (the new photos)
try {
  await page.getByRole('button', { name: 'ساندويش', exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollBy(0, 110));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}\\${PREFIX}_sandwich.png` });
  console.log('sandwich shot OK');
} catch (e) { console.log('sandwich nav failed:', e.message); }

await browser.close();
console.log('DONE');
