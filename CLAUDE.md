# CLAUDE.md · MenuLink Project

> ملف توجيه مختصر لـ Claude Code.
>
> **🆕 ابدأ هنا:** [`memory.md`](./memory.md) — حالة المشروع الحالية، URLs، credentials،
> ما تم بناؤه، الـ gotchas، والمسار للجلسة الجديدة. اقرأها أولاً قبل أي شي.
>
> ثم: `HANDOFF.md` للسياق الاستراتيجي · `DESIGN.md` لقواعد التصميم ·
> `.claude/skills/menulink-integration/learnings.md` لذاكرة المهارة.

## ما هذا المشروع؟

منصة SaaS لقوائم المطاعم + طلبات واتساب للسوق السعودي. الجمهور: مطاعم ومقاهي صغيرة-متوسطة. التسعير: **٥٩ ريال/شهر** أو **٤٩٩ ريال/سنة**.

## الحالة الحالية (محدّثة 2026-05-19)

**كل شي شغّال في الإنتاج.** ٣ surfaces نازلة على Vercel + Supabase:
- 🍔 **Customer PWA v7** — `menulink-admin-five.vercel.app/m/koko` (Next.js، multi-tenant، Stitch design)
- 🏪 **Tenant Admin** — `/admin/*` على نفس الدومين (menu CRUD، orders Realtime، RFM customers)
- 🟣 **Platform Ops** — `/ops/*` على نفس الدومين (تعريف عملاء، payments، تصميم لكل tenant)
- 🔁 **الـ URL القديم** `menulink-eight.vercel.app` يـ 302-redirect للـ v7

**أول عميل دافع:** KO-KO Chicky Licky (live، sub `pending_payment` لحد ما تسجّل أول دفعة).
**مختبر RzRz:** مطعم منفصل (أخوك مدير تشغيلي) — لسا ما بُني الـ Bridge App.

تفاصيل كاملة عن كل شي، URLs، test credentials، الـ schema، والـ next steps في [`memory.md`](./memory.md).

## القرارات المحسومة (لا تعيد النقاش)

- **Frontend:** Next.js 14 + Tailwind + shadcn/ui
- **Backend:** Supabase (لا custom server)
- **Hosting:** Vercel
- **Auth:** OTP عبر SMS (Supabase Auth + Unifonic)
- **Push:** OneSignal
- **Maps:** Leaflet + OpenStreetMap

## قواعد العمل

1. **البساطة قبل الذكاء.** الكود الذي لا تكتبه لا يخرب.
2. **عربية أولاً، RTL أولاً، Mobile أولاً.**
3. **لا تبني ميزة قبل أن يطلبها ٣ عملاء حقيقيون.**
4. **استخدم managed services**، لا تبني infrastructure من الصفر.
5. **اسأل قبل اتخاذ قرارات معمارية كبيرة.**
6. **لا تستخدم localStorage داخل Claude.ai artifacts** (يعمل عند النشر فقط).

## 🧠 المهارة الذاتية التطور

عند العمل على تكامل POS، إضافة عميل جديد، أو حل مشكلة في تدفق الطلبات:

📂 **`.claude/skills/menulink-integration/`** ← Claude Code يحمّلها تلقائياً

تحتوي على:
- ذاكرة متراكمة (`learnings.md`) — اقرأها أولاً
- ملف لكل عميل (`customers/`)
- خمسة مراجع تقنية (`references/`)

**القاعدة الذهبية:** بعد أي جلسة عمل، حدّث `learnings.md` بأي درس جديد. هذا يضمن إن العميل التالي يستفيد من تجربة العميل قبله.

## أين تجد ماذا

| تحتاج | اقرأ |
|------|------|
| 🧭 **ابدأ هنا — AI reading order + decision map** | [`docs/00-start-here/`](./docs/00-start-here/) |
| 🆕 **حالة المشروع الحالية + URLs + credentials** | [`memory.md`](./memory.md) — اقرأها أول شي |
| السياق الاستراتيجي الأصلي | `HANDOFF.md` |
| قواعد التصميم (Stitch-ready) | `DESIGN.md` |
| كود v7 الحالي (Next.js multi-tenant) | `apps/web/app/m/[slug]/` و `apps/web/app/admin/` و `apps/web/app/ops/` |
| كود PWA v6 (legacy، يـ redirect) | `current-state/pwa-starter/` |
| Schema migrations + RPCs | `apps/web/supabase/migrations/` |
| خارطة الطريق | `docs/strategy/ROADMAP.md` |
| استراتيجية POS (RzRz/Foodics) | `docs/strategy/pos-universal-integration.html` |
| المعمارية (system-design + auth/RLS↔Bridge trace) | `docs/architecture/` |
| توثيق POS الاختياري (digital-invoice، gateway، RZRZ ai_memory) | `docs/pos/` |
| **تكامل RzRz / عميل جديد / debugging** | `.claude/skills/menulink-integration/` ⭐ |
| دلائل الإثبات (proofs) | `docs/proofs/` |
| نسخ سابقة (مرجع فقط) | `version-history/` |

## المهمة التالية المقترحة

Session 6 shipped all major features. المتبقي:

- **Addon gating** — delivery zones customer-side + notification center behind addons (sellable services)
- **Bridge App .NET** — heartbeat sender + invoice status poller + POS items catalog sync (APIs ready, .NET code needed)
- **Payment Gateway / Moyasar** — أتمتة جمع ٤٩٩ ريال
- **Samer .NET patch** — re-enable per-type InvoiceType in cashier UI

قرارات منتج: menu-only mode = OPS-only (المالك ما يقدر يفعّله). delivery zones + notification center = خدمات مدفوعة (addons).

## اللغة

تواصل مع المستخدم بالعربي (اللهجة السعودية مقبولة). يفهم المصطلحات التقنية بالإنجليزي بدون ترجمة (مثل database, API, frontend).
