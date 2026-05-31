import { toArabicDigits } from "@/lib/arabic";
import { SLUG_TO_IMG } from "@/lib/koko-images";
import type { PrintTokens } from "@/lib/print-design";

// ============================================================================
// MenuPoster — a single-page A4 "signature menu" POSTER (size=poster), the
// luxe-framed design (dark/gold for premium, light/brand otherwise). Unlike the
// full print menu, this auto-CURATES ~15 signature items (a hero, a featured
// offer, and 4 sections) so it stays one beautiful page instead of a booklet.
// Token-driven via resolvePrintTokens; QR is a real server-generated SVG.
// ============================================================================

type PVariant = { label: string | null; price: number };
type PItem = {
  id: string; slug: string; name_ar: string; image_url: string | null;
  calories_kcal: number | null; variants: PVariant[];
};
type PCategory = { id: string; name_ar: string; emoji: string | null; items: PItem[] };
type PMenu = {
  restaurant: { name: string; logo_url: string | null; city: string | null; tagline_ar: string | null };
  categories: PCategory[];
};

type Pick = { name: string; price: number | null; cal: number | null; img: string | null };

const imgFor = (it: PItem) => it.image_url ?? SLUG_TO_IMG[it.slug] ?? null;
const priceOf = (it: PItem) => {
  const ps = (it.variants || []).map((v) => v.price).filter((p) => p != null);
  return ps.length ? Math.min(...ps) : null;
};
const toPick = (it: PItem): Pick => ({ name: it.name_ar, price: priceOf(it), cal: it.calories_kcal, img: imgFor(it) });
const ar = (n: number | null | undefined) => (n == null ? "" : toArabicDigits(String(n)));

type Section = { title: string; emoji: string | null; items: Pick[] };

// Build up to 4 photo sections from the menu's categories (in order), skipping
// items already used (hero/offer). `minPer` is the per-category floor: the
// strict pass wants >=2 (balanced rows); the lenient pass drops to 1 so a sparse
// menu still fills the poster instead of leaving a blank middle band.
function buildSections(cats: PCategory[], used: Set<string>, minPer: number): Section[] {
  const sections: Section[] = [];
  let budget = 15;
  for (const c of cats) {
    if (sections.length >= 4 || budget <= 0) break;
    const items = c.items.filter((it) => imgFor(it) && !used.has(it.id));
    if (items.length < minPer) continue;
    const take = items.slice(0, Math.min(4, budget));
    take.forEach((it) => used.add(it.id));
    budget -= take.length;
    sections.push({ title: c.name_ar, emoji: c.emoji, items: take.map(toPick) });
  }
  return sections;
}

// True when the menu has at least one item with a usable photo. The poster is
// photo-forward by design, so page.tsx falls through to the standard print menu
// when this is false instead of rendering an empty gold frame.
export function posterHasPhotos(menu: PMenu): boolean {
  return menu.categories.some((c) => c.items.some(imgFor));
}

type Placed = { it: PItem; cat: PCategory };

// Ops can pin a hero/offer item id (restaurants.poster_hero_item_id /
// poster_offer_item_id, DS-12). A pin is honored only if that item is still in
// the menu AND has a usable photo (the poster is photo-forward); otherwise it
// degrades silently to the price-rank pick below — a deactivated or photo-less
// pin never produces a broken slot.
type Overrides = { heroId?: string | null; offerId?: string | null };

// Generic curation: hero = pinned item (if valid) else priciest item with a
// photo; offer = pinned (if valid) else priciest in a different category; then
// up to 4 sections of the remaining photo items. The strict pass prefers >=2
// items per section; if that yields fewer than 2 sections (sparse menu) a
// lenient pass allows single-item sections so the poster is never half-empty.
// Works for any tenant.
function curate(menu: PMenu, overrides: Overrides = {}) {
  const cats = menu.categories.filter((c) => c.items.some(imgFor));
  const photoItems: Placed[] = cats.flatMap((c) => c.items.filter(imgFor).map((it) => ({ it, cat: c })));
  const byPrice = [...photoItems].sort((a, b) => (priceOf(b.it) ?? 0) - (priceOf(a.it) ?? 0));

  // A pin resolves only to a photo-bearing menu item; null otherwise.
  const pinned = (id: string | null | undefined) =>
    id ? photoItems.find((x) => x.it.id === id) ?? null : null;

  const hero = pinned(overrides.heroId) ?? byPrice[0];
  const offer =
    pinned(overrides.offerId) ??
    byPrice.find((x) => x.it.id !== hero?.it.id && x.cat.id !== hero?.cat.id) ??
    byPrice.find((x) => x.it.id !== hero?.it.id);
  const heroOffer = [hero?.it.id, offer?.it.id].filter(Boolean) as string[];

  let sections = buildSections(cats, new Set(heroOffer), 2);
  if (sections.length < 2) sections = buildSections(cats, new Set(heroOffer), 1);

  const nav = cats.slice(0, 6).map((c) => ({ name: c.name_ar, emoji: c.emoji ?? "✦" }));
  return { hero: hero ? toPick(hero.it) : null, offer: offer ? toPick(offer.it) : null, sections, nav };
}

export default function MenuPoster({
  menu, t, qrSvg, heroItemId, offerItemId,
}: {
  menu: PMenu; t: PrintTokens; qrSvg: string;
  heroItemId?: string | null; offerItemId?: string | null;
}) {
  const r = menu.restaurant;
  const { hero, offer, sections, nav } = curate(menu, { heroId: heroItemId, offerId: offerItemId });
  const goldDeep = t.isDark ? "#d8b15a" : t.accent;

  const css = `
  @page{size:A4;margin:0;}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{margin:0;background:#0a0a08;display:flex;align-items:center;justify-content:center;}
  .pmp *{margin:0;padding:0;box-sizing:border-box;}
  .pmp{
    --bg:${t.bg}; --bg2:${t.isDark ? "#1c1a14" : "#ffffff"}; --gold:${t.accent}; --gd:${goldDeep};
    --parch:${t.ink}; --muted:${t.secondary}; --card:${t.cardBg};
    --hair:${t.cardBorder}; --hair2:${t.isDark ? "rgba(230,195,131,0.34)" : "rgba(0,0,0,0.16)"};
    --seal:${t.accentText};
    position:relative;width:794px;height:1123px;overflow:hidden;color:var(--parch);
    background:linear-gradient(160deg,var(--bg) 0%,var(--bg2) 62%,var(--bg) 100%);
    font-family:'Cairo',system-ui,sans-serif;
  }
  .pmp .fo{position:absolute;inset:14px;border:1.5px solid var(--gd);box-shadow:inset 0 0 0 1px rgba(0,0,0,.5);z-index:6;}
  .pmp .fi{position:absolute;inset:20px;border:1px solid var(--hair2);z-index:6;}
  .pmp .cn{position:absolute;width:32px;height:32px;z-index:7;}
  .pmp .cn svg{width:100%;height:100%;display:block;}
  .pmp .tl{top:18px;right:18px;} .pmp .tr{top:18px;left:18px;transform:scaleX(-1);}
  .pmp .bl{bottom:18px;right:18px;transform:scaleY(-1);} .pmp .br{bottom:18px;left:18px;transform:scale(-1,-1);}

  .pmp .content{position:absolute;inset:26px;display:grid;grid-template-rows:78px 52px 182px 74px 1fr 34px;z-index:5;}

  .pmp .hd{display:flex;align-items:center;gap:14px;padding:2px 6px 8px;border-bottom:1px solid var(--hair);}
  .pmp .logo{width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);box-shadow:0 0 0 1px rgba(0,0,0,.4),0 4px 12px rgba(0,0,0,.4);flex-shrink:0;}
  .pmp .brand{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0;}
  .pmp .brand .tg{font-family:'Tajawal';font-weight:500;font-size:10px;color:var(--gd);letter-spacing:3px;}
  .pmp .brand .nm{font-family:'Tajawal';font-weight:900;font-size:31px;line-height:1.05;color:var(--gold);letter-spacing:.5px;}
  .pmp .brand .ct{display:flex;align-items:center;gap:7px;margin-top:2px;color:var(--muted);font-size:12px;font-weight:600;}
  .pmp .brand .ct::before{content:"";width:16px;height:1px;background:var(--gd);}
  .pmp .qr{width:78px;height:78px;background:#fff;border-radius:9px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px;box-shadow:0 4px 12px rgba(0,0,0,.45);}
  .pmp .qr .qs{width:52px;height:52px;}
  .pmp .qr .qs svg{width:100%;height:100%;display:block;}
  .pmp .qr .cap{font-family:'Tajawal';font-weight:700;font-size:8.5px;color:#1a1a1a;line-height:1;}

  .pmp .nav{display:flex;align-items:stretch;justify-content:space-around;gap:6px;padding:8px 4px;border-bottom:1px solid var(--hair);}
  .pmp .ni{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:4px;}
  .pmp .ic{width:32px;height:32px;border-radius:50%;border:1px solid var(--hair);background:radial-gradient(circle at 50% 30%,rgba(230,195,131,.14),var(--card));display:flex;align-items:center;justify-content:center;font-size:16px;}
  .pmp .nl{font-family:'Tajawal';font-weight:700;font-size:9.5px;color:var(--muted);white-space:nowrap;}

  .pmp .hero{position:relative;margin:10px 0 0;border-radius:12px;overflow:hidden;border:1px solid var(--hair2);box-shadow:0 6px 18px rgba(0,0,0,.4);}
  .pmp .hero img{width:100%;height:100%;object-fit:cover;display:block;}
  .pmp .hero .sc{position:absolute;inset:0;background:linear-gradient(0deg,rgba(8,7,5,.92) 0%,rgba(10,9,6,.45) 38%,rgba(0,0,0,0) 70%);}
  .pmp .hero .bd{position:absolute;top:12px;right:14px;font-family:'Tajawal';font-weight:800;font-size:10px;letter-spacing:2px;color:var(--seal);background:var(--gold);padding:5px 12px;border-radius:20px;box-shadow:0 2px 8px rgba(0,0,0,.4);}
  .pmp .hero .mt{position:absolute;bottom:0;right:0;left:0;padding:14px 18px 15px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;}
  .pmp .hero .hn{font-family:'Tajawal';font-weight:900;font-size:28px;color:var(--gold);line-height:1.1;text-shadow:0 2px 6px rgba(0,0,0,.7);}
  .pmp .hero .hc{margin-top:4px;font-size:11px;color:#ece5d8;font-weight:600;}
  .pmp .seal,.pmp .hp{font-family:'Tajawal';font-weight:900;color:var(--seal);background:linear-gradient(145deg,var(--gold),var(--gd));border-radius:50px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,255,255,.4);}
  .pmp .hp{font-size:24px;padding:8px 17px;flex-shrink:0;}
  .pmp .hp small{font-weight:700;font-size:13px;}

  .pmp .offer{margin:10px 0 0;display:flex;align-items:center;gap:13px;background:linear-gradient(120deg,rgba(40,34,20,.55),rgba(31,29,23,.5));border:1px solid var(--gd);border-radius:12px;padding:8px 8px 8px 15px;box-shadow:0 4px 12px rgba(0,0,0,.3);}
  .pmp .offer img{width:62px;height:62px;border-radius:10px;object-fit:cover;border:1px solid var(--hair2);flex-shrink:0;}
  .pmp .offer .ob{flex:1;min-width:0;}
  .pmp .offer .ok{font-family:'Tajawal';font-weight:900;font-size:11px;letter-spacing:3px;color:var(--gold);}
  .pmp .offer .on{font-family:'Tajawal';font-weight:800;font-size:20px;color:var(--parch);line-height:1.15;}
  .pmp .offer .oc{font-size:10.5px;color:var(--muted);font-weight:600;}
  .pmp .offer .hp{font-size:22px;padding:7px 15px;}

  .pmp .secs{padding:8px 0 0;display:flex;flex-direction:column;justify-content:space-between;min-height:0;}
  .pmp .sh{display:flex;align-items:center;gap:10px;margin-bottom:5px;}
  .pmp .sh .t{font-family:'Tajawal';font-weight:900;font-size:16px;color:var(--gold);white-space:nowrap;}
  .pmp .sh .dm{width:7px;height:7px;background:var(--gd);transform:rotate(45deg);flex-shrink:0;}
  .pmp .sh .rl{flex:1;height:1px;background:linear-gradient(90deg,var(--hair2),transparent);}
  .pmp .row{display:grid;gap:8px;}
  .pmp .item{background:var(--card);border:1px solid var(--hair);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 2px 6px rgba(0,0,0,.3);}
  .pmp .item .ph{position:relative;width:100%;height:72px;overflow:hidden;flex-shrink:0;}
  .pmp .item .ph img{width:100%;height:100%;object-fit:cover;display:block;}
  .pmp .item .seal{position:absolute;bottom:6px;right:6px;font-size:12.5px;padding:3px 9px;border:1px solid rgba(255,255,255,.25);}
  .pmp .item .seal small{font-weight:700;font-size:9px;}
  .pmp .item .bd{padding:5px 8px 6px;display:flex;flex-direction:column;gap:1px;flex:1;justify-content:center;}
  .pmp .item .in{font-family:'Tajawal';font-weight:800;font-size:13px;color:var(--parch);line-height:1.2;}
  .pmp .item .icl{font-size:10px;color:var(--muted);font-weight:600;}

  .pmp .ft{display:flex;flex-direction:column;justify-content:flex-end;padding-bottom:2px;}
  .pmp .ft .gr{height:1px;background:linear-gradient(90deg,transparent,var(--gd),transparent);margin-bottom:6px;}
  .pmp .ft .fr{display:flex;align-items:center;justify-content:space-between;font-size:10px;}
  .pmp .ft .sf{color:var(--muted);font-weight:600;}
  .pmp .ft .bf{font-family:'Tajawal';font-weight:800;color:var(--gold);font-size:11.5px;}
  .pmp .ft .pw{color:var(--muted);font-size:9px;font-weight:600;opacity:.8;}
  .pmp .ft .pw b{color:var(--gd);font-weight:800;}
  `;

  const Corner = () => (
    <svg viewBox="0 0 34 34" fill="none">
      <path d="M2 2 L2 14 M2 2 L14 2" stroke={goldDeep} strokeWidth="1.4" />
      <path d="M6 6 C6 11 11 6 16 6" stroke={t.accent} strokeWidth="1.2" fill="none" />
      <circle cx="3.2" cy="3.2" r="1.6" fill={t.accent} />
    </svg>
  );

  return (
    <div dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="pmp">
        <div className="fo" /><div className="fi" />
        <div className="cn tl"><Corner /></div><div className="cn tr"><Corner /></div>
        <div className="cn bl"><Corner /></div><div className="cn br"><Corner /></div>

        <div className="content">
          {/* header */}
          <header className="hd">
            {r.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="logo" src={r.logo_url} alt="" />
            ) : null}
            <div className="brand">
              {r.tagline_ar ? <div className="tg">{r.tagline_ar.slice(0, 28)}</div> : null}
              <div className="nm">{r.name}</div>
              {r.city ? <div className="ct">{r.city}</div> : null}
            </div>
            <div className="qr">
              <div className="qs" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <div className="cap">امسح للطلب</div>
            </div>
          </header>

          {/* icon nav */}
          <nav className="nav">
            {nav.map((n) => (
              <div className="ni" key={n.name}>
                <div className="ic">{n.emoji}</div>
                <span className="nl">{n.name}</span>
              </div>
            ))}
          </nav>

          {/* hero */}
          {hero ? (
            <section className="hero">
              {hero.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero.img} alt="" />
              ) : null}
              <div className="sc" />
              <div className="bd">طبق التوقيع</div>
              <div className="mt">
                <div>
                  <div className="hn">{hero.name}</div>
                  {hero.cal ? <div className="hc">🔥 {ar(hero.cal)} سعرة حرارية</div> : null}
                </div>
                {hero.price != null ? <div className="hp">{ar(hero.price)} <small>ر.س</small></div> : null}
              </div>
            </section>
          ) : <div />}

          {/* offer */}
          {offer ? (
            <section className="offer">
              {offer.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={offer.img} alt="" />
              ) : null}
              <div className="ob">
                <div className="ok">★ عرض اليوم</div>
                <div className="on">{offer.name}</div>
                {offer.cal ? <div className="oc">🔥 {ar(offer.cal)} سعرة حرارية</div> : null}
              </div>
              {offer.price != null ? <div className="hp">{ar(offer.price)} <small>ر.س</small></div> : null}
            </section>
          ) : <div />}

          {/* sections */}
          <div className="secs">
            {sections.map((s) => (
              <div className="section" key={s.title}>
                <div className="sh"><span className="dm" /><span className="t">{s.title}</span><span className="rl" /><span className="dm" /></div>
                <div className="row" style={{ gridTemplateColumns: `repeat(${s.items.length}, 1fr)` }}>
                  {s.items.map((it, i) => (
                    <div className="item" key={i}>
                      <div className="ph">
                        {it.img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.img} alt="" />
                        ) : null}
                        {it.price != null ? <span className="seal">{ar(it.price)} <small>ر.س</small></span> : null}
                      </div>
                      <div className="bd">
                        <div className="in">{it.name}</div>
                        {it.cal ? <div className="icl">🔥 {ar(it.cal)} سعرة</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* footer */}
          <footer className="ft">
            <div className="gr" />
            <div className="fr">
              <div className="sf">جميع الأسعار شاملة الضريبة • السعرات إرشادية</div>
              <div className="bf">{r.name}{r.city ? ` • ${r.city}` : ""}</div>
              <div className="pw">Powered by <b>MenuLink</b></div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
