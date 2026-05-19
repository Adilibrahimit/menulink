# 🍔 MenuLink

> منصة SaaS عربية للمطاعم السعودية: قوائم رقمية، طلبات واتساب، تحليلات عملاء، ولوحة تحكم للمطعم.

## ابدأ من هنا

| لو أنت... | اقرأ |
|----------|------|
| 🤖 **Claude Code** / AI assistant جاي يكمل في session جديدة | **[`memory.md`](./memory.md)** ← اقرأها أولاً |
| 👤 صاحب المشروع | [`memory.md`](./memory.md) (state) ثم [`HANDOFF.md`](./HANDOFF.md) (السياق الأصلي) |
| 🎨 تبغى تفهم قواعد التصميم | [`DESIGN.md`](./DESIGN.md) — Stitch-ready design system |
| 💼 التسعير | [`PRICING.md`](./PRICING.md) |
| 💻 تبغى تشتغل على الـ admin / customer PWA / ops | [`apps/web/`](./apps/web/) |
| 🛣️ خارطة الطريق | [`design-docs/ROADMAP.md`](./design-docs/ROADMAP.md) |
| 🍗 **تكامل POS / عميل جديد / debugging** | [`.claude/skills/menulink-integration/`](./.claude/skills/menulink-integration/) ⭐ |

## ملخص بـ ٣ نقاط

1. **الفكرة:** قوائم احترافية + طلبات واتساب للمطاعم بـ ٥٩ ر/شهر أو ٤٩٩ ر/سنة.
2. **الحالة:** Multi-tenant SaaS كامل — customer PWA + tenant admin + platform ops + marketing landing — كلها live على Supabase + Vercel.
3. **التالي:** RzRz Bridge App (الـ POS moat) أو Push Marketing أو Payment Gateway. تفاصيل في `memory.md`.

## URLs الحية

| URL | What |
|---|---|
| `menulink-admin-five.vercel.app/` | Marketing landing |
| `menulink-admin-five.vercel.app/m/koko` | **KO-KO customer PWA · v7 · canonical** |
| `menulink-admin-five.vercel.app/m/<slug>` | Multi-tenant — أي مطعم منشور |
| `menulink-admin-five.vercel.app/admin` | Tenant owner dashboard |
| `menulink-admin-five.vercel.app/ops` | Platform admin (ops) |
| `menulink-eight.vercel.app/` | Legacy — 302 → `/m/koko` |

## بنية المجلدات

```
menulink/
├── memory.md                ← 🆕 حالة المشروع الحالية · اقرأها أول شي
├── HANDOFF.md               ← السياق الاستراتيجي الأصلي
├── CLAUDE.md                ← توجيه Claude (auto-loaded)
├── DESIGN.md                ← قواعد التصميم
├── PRICING.md               ← التسعير
├── README.md                ← أنت هنا
├── vercel.json              ← redirects للـ legacy project
│
├── apps/
│   └── web/                 ← Next.js 14 — كل الـ runtime
│       ├── app/
│       │   ├── page.tsx     ← Marketing landing
│       │   ├── m/[slug]/    ← Customer PWA v7 (multi-tenant)
│       │   ├── admin/       ← Tenant owner dashboard
│       │   └── ops/         ← Platform admin
│       ├── lib/             ← Supabase clients + auth + types
│       ├── public/menu/koko/ ← KO-KO food photos (jpegs)
│       └── supabase/
│           └── migrations/  ← 7 SQL migrations applied to cloud
│
├── current-state/
│   └── pwa-starter/         ← v6 legacy PWA (still in repo, redirects to v7)
│
├── design-docs/             ← المعمارية والـ POS strategy
├── .claude/skills/          ← menulink-integration skill (POS knowledge)
├── .graph/                  ← graphify knowledge graph (Obsidian)
└── version-history/         ← نسخ v1-v5 للأرشيف
```

## النشر السحابي

- **Supabase:** [`dhmjrrsynfvomlzhggvu`](https://supabase.com/dashboard/project/dhmjrrsynfvomlzhggvu) (Singapore) — 6 جداول + 6 views + 5 RPCs + Storage bucket
- **Vercel:** مشروعين على نفس الـ repo:
  - `menulink-admin` → Next.js admin من `apps/web/`
  - `menulink` → static legacy، يـ redirect للأول

تفاصيل كاملة في [`memory.md`](./memory.md).
