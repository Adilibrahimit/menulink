// Shared helpers for the MenuLink photo-catalog tooling.
// ESM. Run with node from anywhere. Reads secrets from env or local files (never hardcoded).
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// sharp must be required by absolute path — scripts run outside the apps/web package.
export const sharp = require("D:/menulink/apps/web/node_modules/sharp");

const PROJECT_REF = "dhmjrrsynfvomlzhggvu";
export const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
export const STORAGE_PUBLIC = `${SUPABASE_URL}/storage/v1/object/public/menu-images/`;

// Live tenants we catalog (skip *-test clones).
export const TENANTS = {
  koko: "11111111-1111-1111-1111-111111111111",
  "rzrz-bukhari": "ef60381c-50db-4379-a9b7-97f5902aa54b",
  "mazaj-almosafer": "9f19fe0d-e1fd-482d-a9b1-e3c7ec99ef59",
  "coffee-secret": "ee2a7b70-b661-43cf-aeca-79ff9bd2529a",
};

const PAT_FILE = "C:/Users/USER/.claude/projects/d--menulink/memory/reference_supabase_pat.md";
const ENV_FILE = "D:/menulink/apps/web/.env.local";

export function getPAT() {
  const fromEnv = process.env.SUPABASE_PAT;
  if (fromEnv) return fromEnv;
  return (readFileSync(PAT_FILE, "utf8").match(/sbp_[A-Za-z0-9]+/) || [])[0];
}
export function getServiceRole() {
  const fromEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fromEnv) return fromEnv;
  if (!existsSync(ENV_FILE)) return null;
  return (readFileSync(ENV_FILE, "utf8").match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m) || [])[1]
    ?.trim().replace(/^["']|["']$/g, "");
}

const PAT = getPAT();
export async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json", "User-Agent": "menulink-catalog/1.0" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`sql ${r.status}: ${await r.text()}`);
  return r.json();
}

// English -> kebab slug. Arabic names fall through to a transliteration-free placeholder.
export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[’'"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Canonical category folders. Order matters (fruit-salad before salad, mojito before juice…).
const CAT_RULES = [
  ["shisha", /shisha|hookah|hooka|شيشة|شيش|نرجيل|معسل|hubbly/i],
  ["mojito", /mojito|موهيتو|موهيت/i],
  ["fruit-salads", /fruit.?salad|سلطات?\s*فواكه|سلطة\s*فواكه/i],
  ["ice-cream", /ice.?cream|آيس\s*كريم|ايس\s*كريم|بوظة|بوظه|gelato|جيلاتو/i],
  ["milkshakes", /milk.?shake|ميلك\s*شيك|ميلكشيك/i],
  ["tea", /\btea\b|iced.?tea|شاي|أعشاب|اعشاب|tea-herbs|كرك|karak|ginger|زنجبيل|yansoon|يانسون|نعناع|mint\s*tea|sahlab|سحلب/i],
  ["juices", /juice|عصائر|عصير|smoothie|سموزي|سموذي|cocktail|كوكتيل|فخفخ|lemonade|ليمون|avocado|avacado|افوكادو|أفوكادو/i],
  ["cold-drinks", /cold.?drink|بارد|iced|مثلج|frapp|frape|فراب|صودا|soda|بيبسي|pepsi|7up|سفن|cola|كولا|sprite|mirinda|ميرندا|holsten|هولست|red.?bull|رد\s*بول|code.?red|water\s*glass|sparkling|مياه|بطيخ.*juice/i],
  ["coffee", /hot.?drink|ساخن|قهوة|coffee|coffe|espresso|اسبريسو|latte|لاتيه|cappuc|capach|كابتش|macchiat|ميكات|موكا|mocha|cortado|كورتادو|flat\s*white|americano|امريكانو|نسكافيه|nescafe/i],
  ["desserts", /sweet|dessert|حلى|حلو|حلويات|كيك|cake|cheesecake|تشيز|كريب|crepe|waffle|وافل|بان\s*كيك|pancake|كنافة|كنافه|tiramis|تيرامي|دونات|donut|doughnut|كوكيز|cookie|french\s*toast|توست|cinnabon|cinabon|cinnamon\s*roll|souffle|soufle|سوفل|muhallebi|mhlbia|mahalabia|مهلبية|um\s*ali|أم\s*علي|sebastian|sabistan|pecan|brownie|بروني|muffin|مافن|\bpie\b|frappe.*dessert|fondant|lava|كاسترد|custard|pudding|بودينج|قطايف|qatayef|بسبوسة/i],
  ["sandwiches", /sandwich|sandwa|ساندو|برغر|برجر|burger|شاورما|shawarma|راب|wrap|فاهيتا|fajita|زينجر|zinger|broast|بروست|tender|تندر|halloumi|halomy|حلوم|panini|بانيني|club\s*sandwich/i],
  ["appetizers", /appetiz|مقبلات|مقبل|بطاطا|fries|بطاط|كبة|kibbeh|ناجت|nugget|دايناميت|dynamite|spring.?roll|سبرينج|hummus|حمص|baba.?ganoush|بابا|moutabel|mutabbal|متبل|\bsoup\b|شوربة|شوربه|lentil|عدس/i],
  ["mains", /platter|أطباق|اطباق|بلايت|rice|رز|مندي|mandi|بخاري|bukhari|كبسة|kabsa|مشاوي|grill|باستا|pasta|بيتزا|pizza|دجاج|chicken|لحم|meat|kabab|kbab|kbah|كباب|kofta|كفتة|كفته|lamb|خروف|mutton|steak|staek|chops|liver|كبدة|casserole|moussaka|mousska|risotto|risorto|jareesh|جريش|garish|تمن|alfredo|بشاميل|beshamil/i],
  ["salads", /salad|سلطات|سلطة|tabbouleh|tabouleh|taboulah|تبولة|fattoush|فتوش|fatoush/i],
];
export function canonicalCategory(...hints) {
  const hay = hints.filter(Boolean).join(" ");
  for (const [folder, re] of CAT_RULES) if (re.test(hay)) return folder;
  return "misc";
}

export const SKILL_DATA = "D:/menulink/.claude/skills/menulink-photo-catalog/data";
export const LIBRARY_ROOT = "D:/menulink/docs/clients/ITEMS_PHOTO/OneDrive_2026-05-25/Menu Pics";
export const SCRATCH = "C:/Users/USER/AppData/Local/Temp/claude/d--menulink/3b388fca-8294-4113-88da-7d3e2fd79d7b/scratchpad";
