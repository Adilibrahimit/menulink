# CLAUDE.md · MenuLink Project

> ملف توجيه مختصر لـ Claude Code. اقرأ HANDOFF.md للسياق الكامل.

## ما هذا المشروع؟

منصة SaaS لقوائم المطاعم + طلبات واتساب للسوق السعودي. الجمهور: مطاعم ومقاهي صغيرة-متوسطة. التسعير: **٥٩ ريال/شهر** أو **٤٩٩ ريال/سنة**.

## الحالة الحالية

PWA v6 شغّال في `current-state/pwa-starter/`. جاهز للنشر. **العميل الأول الدافع:** KO-KO Chicky Licky (طلب نسختين). **مختبر تكامل RzRz:** مطعم منفصل (أخوك مدير تشغيلي فيه).

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
| السياق الكامل والقرارات | `HANDOFF.md` |
| كود PWA الشغّال | `current-state/pwa-starter/` |
| دليل النشر | `current-state/pwa-starter/README-DEPLOY.md` |
| خارطة الطريق | `design-docs/ROADMAP.md` |
| المعمارية الكاملة | `design-docs/system-design.html` |
| استراتيجية POS | `design-docs/pos-universal-integration.html` |
| Multi-tenant | `design-docs/tenant-config-example.js` |
| **تكامل RzRz / عميل جديد / debugging** | `.claude/skills/menulink-integration/` ⭐ |
| نسخ سابقة (مرجع فقط) | `version-history/` |

## المهمة التالية المقترحة

نشر v6 على Manus.space أو Netlify لـ KO-KO (العميل التجريبي) ثم بدء بيعه لمطاعم أخرى. **لا تبدأ phase 2 (Next.js + Supabase) قبل ٣-٥ عملاء يدفعون فعلياً.**

## اللغة

تواصل مع المستخدم بالعربي (اللهجة السعودية مقبولة). يفهم المصطلحات التقنية بالإنجليزي بدون ترجمة (مثل database, API, frontend).
