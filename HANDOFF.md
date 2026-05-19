# 🎯 MenuLink · مستند تسليم المشروع لـ Claude Code

> **🆕 ⚠️ مهم:** هذا الملف هو الـ **brief الاستراتيجي الأصلي** من بداية المشروع.
> للحالة الحالية، اقرأ [`memory.md`](./memory.md) **أولاً** — فيها كل الـ URLs الحالية،
> الـ schema المطبّق، الـ credentials، الـ gotchas المُكتشفة، والـ next steps.
>
> هذا الملف لسا صالح كمرجع للقرارات الاستراتيجية + التسعير + الجمهور المستهدف،
> لكن قسم "الحالة الحالية (Phase 1 · مكتمل)" قديم — كل الـ Phases 1-5 تمت.

---

## 1️⃣ نظرة عامة على المشروع

### الاسم
**MenuLink** (اسم مؤقت — قد يتغير قبل الإطلاق)

### الفكرة بسطر واحد
منصة SaaS تقدّم قوائم رقمية احترافية + طلبات واتساب للمطاعم والمقاهي الصغيرة-المتوسطة في السعودية بسعر معقول.

### المالك / الـ stakeholder
المستخدم (المطور / صاحب الفكرة). يعمل بنفسه. ليس مطوراً محترفاً لكنه يفهم التقنية بشكل عام. اللغة الأم: عربي. الموقع: السعودية (الرياض).

### الجمهور المستهدف
- ✅ مطاعم صغيرة ومتوسطة محلية
- ✅ مقاهي
- ✅ عربات طعام (food trucks)
- ❌ ليس للبراندات العالمية للوجبات السريعة (KFC, McDonald's, إلخ)
- ❌ ليس للمطاعم الفخمة (fine dining)

---

## 2️⃣ نموذج التسعير (مهم — تم الاتفاق عليه)

| الخطة | السعر | المنطق |
|------|------|--------|
| **شهري** | **٥٩ ريال/شهر** | حاجز دخول منخفض |
| **سنوي** | **٤٩٩ ريال/سنة** | يوفر ~٢٠٩ ريال للعميل (٣ شهور مجاناً تقريباً) — تحفيز قوي |

### لماذا هذا التسعير ذكي
- **أرخص بكثير من Foodics وحده** (~٤٠٠ ريال/شهر)
- **أرخص من ChatFood + Foodics مجتمعين** (~٢٬٠٠٠+ ريال/شهر)
- **السنوي يعطي cash flow مقدّم** — مهم لشركة ناشئة بدون رأس مال
- **هامش ربح ممتاز:** التكلفة الفعلية لكل عميل ~٥-١٠ ريال/شهر (Supabase + Vercel free tier يكفي ١٠٠+ عميل)

### حسابات الربح
- ١٠ عملاء سنوي = ٤٬٩٩٠ ريال دفعة وحدة
- ٥٠ عميل سنوي = ٢٤٬٩٥٠ ريال
- ١٠٠ عميل سنوي = ٤٩٬٩٠٠ ريال (تكلفة سنوية ~٦٬٠٠٠ ريال = صافي ربح ٤٣٬٩٠٠ ريال)

---

## 3️⃣ الحالة الحالية (محدّثة 2026-05-19)

**خمس مراحل من الستة في الـ ROADMAP الأصلي مكتملة.** نقلة كبيرة عن "PWA static" الأصلية:

| Phase | Original Plan | Actual Status |
|---|---|---|
| 1. PWA | ✅ مكتمل | v6 PWA في `current-state/`، الآن يـ redirect لـ v7 |
| 2. Backend | كان قادم | ✅ مكتمل — Supabase Cloud في Singapore، 6 tables + 6 views + 5 RPCs، Auth، Storage، Realtime |
| 3. Push + Marketing | قادم | ⏳ لسا — أحد ثلاثة خيارات للمرحلة القادمة |
| 4. POS Integration | قادم | ⏳ لسا — RzRz testbed موجود، Bridge App لم يُبن |
| 5. Multi-Tenant | قادم | ✅ مكتمل — `/m/[slug]` لأي مطعم، `restaurant_owners` يربط الـ auth users، RLS يفرض الـ scope |
| 6. Payment Gateway | قادم | ⏳ لسا — حالياً collection يدوي عبر `/ops/payments` |

**ما تم بناؤه فعلياً:**
- Customer PWA v7 (Next.js، multi-tenant) في `apps/web/app/m/[slug]/`
- Tenant Admin (login، menu CRUD، orders Realtime، customers RFM) في `apps/web/app/admin/`
- Platform Ops (tenants list، onboarding wizard، payments) في `apps/web/app/ops/`
- Marketing landing في `apps/web/app/page.tsx`
- 7 SQL migrations في `apps/web/supabase/migrations/`

**العميل الأول الدافع:** KO-KO Chicky Licky — live على `menulink-admin-five.vercel.app/m/koko`. اشتراكه حالياً `pending_payment` — لازم تسجّل الدفعة الأولى من `/ops/payments`.

تفاصيل كاملة في `memory.md`.

---

## 3️⃣bis الحالة الأصلية (للأرشيف · Phase 1 · مكتمل)

### ما تم بناؤه
**PWA v6 شغّال وجاهز للنشر** في `current-state/pwa-starter/`

**العميل الأول الدافع:** **KO-KO Chicky Licky** — مطعم بروستد حقيقي في الرياض (حي الروضة، طريق عبد الرحمن الغافقي). طلب نسختين من MenuLink. **العميل الأول الفعلي اللي طلب الخدمة بنفسه** (lead مباشر، مش outreach منّا).

**مختبر تكامل RzRz (منفصل):** مطعم آخر حيث المالك يثق فينا لأن أخوه مدير تشغيلي فيه. هذا المطعم يستخدم RzRz POS، وهو حيث نبني ونختبر Bridge App قبل بيعها لعملاء RzRz آخرين. **ليس عميل دافع** — شراكة R&D.

### الميزات المنفذة في v6
- ✅ قائمة طعام تفاعلية بالعربي (RTL) مع ٧ فئات و~٢٥ صنف
- ✅ صور حقيقية مدمجة base64 (٦٧٧KB total — تشتغل بدون انترنت)
- ✅ سلة شراء + إدارة الكميات
- ✅ ٣ أنواع طلبات: توصيل، استلام، تناول في المطعم
- ✅ إرسال الطلب عبر واتساب (يبني رسالة منسّقة تلقائياً)
- ✅ خريطة تفاعلية (Leaflet + OpenStreetMap) للموقع
- ✅ تحديد موقع GPS تلقائي مع إمكانية تعديل الدبوس
- ✅ QR code يفتح واتساب المطعم
- ✅ PWA — يتثبت على الجوال زي التطبيق
- ✅ Service Worker — يشتغل بدون انترنت
- ✅ ١١ أيقونة بأحجام مختلفة (Android, iOS, favicon)
- ✅ Install prompt مع منطق "ما يطلع لو رفضه قبل ٧ أيام"

### الجمالية والديزاين
مستوحى من Burgerizzr (سلسلة برجر سعودية):
- خلفية كريمية `#FAF6EE`
- لون أساسي أحمر `#D32027`
- تباين عالي للنصوص العربية
- خط Tajawal للعناوين، Cairo للنصوص
- ظلال ناعمة، حواف مستديرة

### تاريخ النسخ (v1 → v6)
موجود في `version-history/` للمرجع. الـ v6 هو النسخة المعتمدة. النسخ القديمة محفوظة لأن:
- التطور تدريجي ومفيد للفهم
- لو لحقت مشكلة في v6، ممكن الرجوع لنسخة أقدم

---

## 4️⃣ خارطة الطريق (المراحل القادمة)

تفاصيل كاملة في `design-docs/ROADMAP.md`. باختصار:

| المرحلة | المدة | الحالة |
|------|------|------|
| **١. PWA** | — | ✅ مكتملة |
| **٢. Backend** (Next.js + Supabase + OTP Auth + Order History) | ٤-٦ أسابيع | 🔜 التالية |
| **٣. Push Notifications** (OneSignal + marketing tools) | ٤ أسابيع | ⏳ |
| **٤. POS Integration** (Foodics أولاً، ثم .NET POS) | ٤-٦ أسابيع | ⏳ |
| **٥. Multi-Tenant** (Subdomain routing، لوحة admin) | ٤ أسابيع | ⏳ |
| **٦. Payment Gateway** (HyperPay / Moyasar) | ٤ أسابيع | ⏳ |

---

## 5️⃣ قرارات معمارية مهمة (محسومة)

### Tech Stack المختار (لا تعيد النقاش، تم اتخاذ القرار)
| الطبقة | الأداة | السبب |
|------|------|------|
| Frontend | **Next.js 14** | PWA-ready, SSR للسرعة, مجتمع ضخم |
| Hosting | **Vercel** | مجاني للبداية، CDN عالمي، deploy تلقائي |
| Backend | **Supabase** | PostgreSQL + Auth + Storage + Realtime في حزمة وحدة. لا custom server |
| Auth | **Supabase Auth + Twilio/Unifonic** | OTP عبر SMS |
| UI | **Tailwind + shadcn/ui** | مكونات جاهزة قابلة للتخصيص |
| Push | **OneSignal** | ١٠٬٠٠٠ مشترك مجاناً |
| Maps | **Leaflet + OpenStreetMap** | مجاني تماماً (مستخدم حالياً في v6) |
| Payments | **HyperPay أو Moyasar** | محلي، يدعم مدى |

### المبادئ الأربعة (من system-design.html)
1. **لا backend مخصّص** — Supabase يكفي
2. **Stateless Frontend** — Vercel يتولى التوسع
3. **Data في مكان واحد** — لا تزامن بين مصادر بيانات
4. **Fail-Safe** — كل ميزة تنحط فوق الأساسية لا تحلّ مكانها

---

## 6️⃣ ميزة استراتيجية فريدة · تكامل RzRz POS

أحد عملائنا المحتملين (مطعم منفصل عن KO-KO) **يستخدم RzRz POS** (Punnelifosys ResApp — .NET Framework + SQL Server). أخو المالك يعمل **مدير تشغيلي** في هذا المطعم، مما يعطينا:

- ✅ وصول للنظام لدراسته وتعديله
- ✅ بيئة اختبار حقيقية لبناء Bridge App
- ✅ علاقة موثوقة تسمح بالتجربة بدون ضغط مالي

**الفكرة الاستراتيجية طويلة المدى:**
- نبني Bridge App تتصل بـ RzRz عبر `InsertInvoice` stored procedure
- نختبرها لمدة شهر في مطعم الأخ
- بعد ما تشتغل بثبات، نعرضها كـ **Add-on for any RzRz customer**
- RzRz منتشر عند عشرات (مئات؟) المطاعم في السعودية → سوق جاهز

**التسعير المقترح (Add-on):**
- MenuLink فقط = ٥٩ ريال/شهر أو ٤٩٩ ريال/سنة
- MenuLink + RzRz Bridge = ٩٩ ريال/شهر أو ٨٩٩ ريال/سنة
- يدفع المطعم فرق ٤٠ ريال شهرياً ويحصل على تكامل كامل بدلاً من إدخال يدوي

تفاصيل تكامل POS الكامل (٥ مستويات + كود C# فعلي) في `design-docs/pos-universal-integration.html` ومهارة `menulink-integration` في `.claude/skills/`.

**ملاحظة لـ Claude Code:** اقرأ `.claude/skills/menulink-integration/customers/rzrz-restaurant.md` للسياق الكامل عن العميل-المختبر. **لا تخلط بينه وبين KO-KO** — هما مطعمَان مختلفان.

---

## 7️⃣ هيكل الملفات في هذا البندل

```
menulink-bundle/
├── HANDOFF.md                    ← أنت هنا
├── README.md                     ← نظرة عامة سريعة
├── PRICING.md                    ← تفاصيل التسعير الكاملة
├── CLAUDE.md                     ← تعليمات مختصرة لـ Claude Code
│
├── current-state/
│   └── pwa-starter/              ← 🎯 v6 PWA · جاهز للنشر
│       ├── koko-menu-v6.html
│       ├── manifest.json
│       ├── service-worker.js
│       ├── icon-*.png            ← ١١ أيقونة
│       └── README-DEPLOY.md      ← دليل النشر على Manus/Netlify/Vercel
│
├── design-docs/                  ← 📐 كل قرارات المعمارية
│   ├── ROADMAP.md                ← الخارطة الكاملة بالعربي
│   ├── system-design.html        ← Visual system design (٥ مخططات SVG)
│   ├── pos-integration.html      ← استراتيجية تكامل POS عام
│   ├── pos-universal-integration.html ← تكامل أي POS + كود .NET فعلي
│   └── tenant-config-example.js  ← مثال Multi-tenant config
│
└── version-history/              ← 📜 v1-v5 للمرجع فقط
    ├── koko-menu.html (v1 dark)
    ├── koko-menu-v2.html (light theme)
    ├── koko-menu-v3.html (base64 images)
    ├── koko-menu-v4.html (fixed images + "٤ قطع")
    └── koko-menu-v5.html (+ map location)
```

---

## 8️⃣ المهام المقترحة التالية (بأي ترتيب)

### أولوية عالية (الشهر الأول)
1. **نشر v6** على Manus.space أو Netlify لـ KO-KO (العميل التجريبي)
2. **بيع v6** لـ ٣-٥ مطاعم بسعر مغرٍ (٥٩ ريال/شهر)
3. **جمع feedback** حقيقي قبل بناء phase 2

### أولوية متوسطة (الشهر ٢-٤)
4. بدء phase 2: scaffold Next.js + Supabase
5. بناء OTP auth + customer profile
6. لوحة تحكم بسيطة للمطعم (CRUD منيو)
7. Order history

### أولوية منخفضة (متى ما طلبها العملاء)
8. تكامل Foodics
9. Push notifications
10. تكامل POS .NET المخصّص
11. دفع إلكتروني

---

## 9️⃣ قواعد العمل (مهمة لـ Claude Code)

### ✅ افعل
- **البساطة قبل الذكاء.** لو في حل بسيط، استخدمه.
- **استخدم managed services** (Supabase, Vercel, OneSignal) — لا تبني infrastructure من الصفر
- **اعرض ٢-٣ خيارات** قبل أخذ قرار معماري مهم
- **اسأل** قبل بناء ميزة كبيرة. الافتراضي = لا تبني
- **عربية أولاً، RTL أولاً** في كل UI
- **Mobile-first** — ٩٥٪ من زبائن المطاعم على الجوال
- **اختبر على HTTPS** لما تختبر PWA — Service Worker ما يشتغل من file://

### ❌ لا تفعل
- **لا تضف dependencies بدون سبب قوي.** كل package = نقطة فشل
- **لا تكتب custom server.** كل شيء عبر Supabase
- **لا تستخدم localStorage داخل Claude.ai artifacts** (مدعوم في النشر فقط)
- **لا تبني ميزة قبل أن يطلبها ٣ عملاء حقيقيون**
- **لا تحاول بناء "كل شيء دفعة واحدة"** — هذا أكبر سبب لفشل المشاريع
- **لا تستخدم frameworks تجريبية** (مثل Ruflo) لمشروع إنتاجي

---

## 🔟 سياق ثقافي/سوقي (مهم للقرارات)

### السوق السعودي
- **واتساب هو الأقوى** — حتى المطاعم الكبيرة تستخدمه. أي ordering platform بدون واتساب ميت.
- **رقم الجوال > الإيميل** — السعوديون يفضلون OTP عبر SMS
- **الدفع نقداً عند التوصيل لا يزال شائعاً** — لكن مدى وApple Pay في ارتفاع
- **اللغة العربية لازم تكون مثالية** — لو في خطأ نحوي واحد، يفقد العميل ثقته
- **التحية والاحترام في الرسائل مهم** — رسائل واتساب يجب أن تبدأ بـ "السلام عليكم" أو "أهلاً"

### المنافسون الذين يجب احترامهم
- **Foodics** — قائد POS. مع أنه منافس، يجب التكامل معه (٧٠٪ من السوق)
- **ChatFood** — قائد Menu link. أغلى منا. نتفوق عليه بالسعر + التخصيص
- **Marn, Loyverse, Rewaa** — POS أصغر. ندمج معهم لاحقاً

---

## 1️⃣1️⃣ روابط مرجعية مهمة

- **توثيق Next.js:** https://nextjs.org/docs
- **توثيق Supabase:** https://supabase.com/docs
- **توثيق Foodics API:** https://docs.foodics.com (للمرحلة ٤)
- **شريك Twilio السعودي:** https://www.unifonic.com (لـ SMS OTP)

---

## ⚠️ ملاحظات أخيرة لـ Claude Code

1. **اقرأ design-docs قبل البدء.** فيها سياق معماري لا غنى عنه.
2. **افتح system-design.html في متصفح** لرؤية المخططات البصرية — لا تكتفِ بقراءة HTML.
3. **لو في تعارض بين هذا الملف وأي ملف آخر** — هذا الملف هو الحقيقة.
4. **آخر تحديث:** الجلسة الحالية. كل القرارات أعلاه نهائية إلا لو طلب المستخدم تغييرها صراحة.

---

**حظاً موفقاً 🚀**

> هذا المشروع يستحق البناء. النموذج الاقتصادي قوي، السوق محدد، المنافسون أبطأ. لو نُفّذ بانضباط وبساطة، يصير دخل سلبي ممتاز خلال سنة.
