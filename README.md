# 🍔 MenuLink

> منصة قوائم رقمية وطلبات واتساب للمطاعم والمقاهي السعودية الصغيرة-المتوسطة.

## ابدأ من هنا

| لو أنت... | اقرأ |
|----------|------|
| 🤖 **Claude Code** أو AI assistant | [`CLAUDE.md`](./CLAUDE.md) ثم [`HANDOFF.md`](./HANDOFF.md) |
| 👤 صاحب المشروع | [`HANDOFF.md`](./HANDOFF.md) للسياق الكامل |
| 💼 تبغى تشوف الأسعار | [`PRICING.md`](./PRICING.md) |
| 🚀 تبغى تنشر النسخة الحالية | [`current-state/pwa-starter/README-DEPLOY.md`](./current-state/pwa-starter/README-DEPLOY.md) |
| 🏗️ تبغى تفهم المعمارية | افتح [`design-docs/system-design.html`](./design-docs/system-design.html) في متصفح |
| 🛣️ تبغى تشوف خارطة الطريق | [`design-docs/ROADMAP.md`](./design-docs/ROADMAP.md) |
| 💻 تبغى تشتغل على الـ backend | [`apps/web/`](./apps/web/) (Next.js + Supabase scaffold) |

## ملخص بـ ٣ نقاط

1. **الفكرة:** قوائم احترافية + طلبات واتساب للمطاعم بـ ٥٩ ر/شهر
2. **الحالة:** PWA v6 شغّال في `current-state/pwa-starter/` — جاهز للنشر اليوم
3. **التالي:** نشر لـ ٣-٥ عملاء حقيقيين، ثم بناء phase 2 (Next.js + Supabase)

## بنية المجلدات

```
menulink/
├── HANDOFF.md           ← مستند تسليم كامل
├── CLAUDE.md            ← توجيه مختصر لـ Claude Code
├── README.md            ← أنت هنا
├── PRICING.md           ← التسعير
├── current-state/       ← v6 PWA (الإنتاج الحالي · مربوط بـ Supabase)
├── apps/
│   └── web/             ← Next.js 14 + Supabase scaffold (مستقبل: لوحة تحكم المطعم)
├── design-docs/         ← المعمارية والـ POS strategy
├── .graph/              ← knowledge graph من /graphify (افتحه في Obsidian)
├── .obsidian/           ← Obsidian vault marker
└── version-history/     ← نسخ سابقة (v1-v5)
```

## النشر السحابي

- **Supabase:** [`dhmjrrsynfvomlzhggvu`](https://supabase.com/dashboard/project/dhmjrrsynfvomlzhggvu) (Singapore region) — جدولين أساسية + ٦ views للتحليلات.
- **Vercel:** يستضيف v6 PWA. شوف [`current-state/pwa-starter/README-DEPLOY.md`](./current-state/pwa-starter/README-DEPLOY.md).
