# 🍔 خارطة طريق المشروع · من ملف HTML إلى منصة SaaS متكاملة

> هذا المستند يشرح كيف نطوّر مشروع قوائم المطاعم من ملف HTML واحد إلى **منصة حقيقية متعددة العملاء** يمكنك بيعها باشتراك شهري.
>
> **🆕 محدّث 2026-05-19:** الـ Phases 1، 2، و5 مكتملة كلياً. تفاصيل كاملة في [`memory.md`](../memory.md).

---

## 📍 أين نحن الآن (محدّث 2026-05-19)

**Multi-tenant SaaS كامل في الإنتاج:**
- ✅ Customer PWA v7 (Next.js multi-tenant) على `menulink-admin-five.vercel.app/m/koko`
- ✅ Tenant Admin (login، menu CRUD، orders Realtime، RFM customers)
- ✅ Platform Ops (onboarding wizard، payments، tenant design)
- ✅ Marketing landing
- ✅ Supabase Cloud (Singapore) — 6 tables، 6 views، 5 RPCs، Storage bucket
- ✅ Legacy v6 URL يـ redirect 302 للـ v7

**اللي لسا:**
- ⏳ Phase 3 — Push + Marketing (OneSignal، broadcast لـ dormant customers)
- ⏳ Phase 4 — POS Integration (RzRz Bridge App، Foodics OAuth)
- ⏳ Phase 6 — Payment Gateway (Moyasar أو Tap، حالياً collection يدوي)

---

## 📜 الحالة الأصلية للأرشيف (Phase 0 · v6 static HTML)

**ما كان عندنا في البداية:**
- ملف HTML واحد فيه قائمة كاملة بالصور والـ QR
- PWA يتثبت على الجوال
- يعمل بدون إنترنت (للقائمة على الأقل)
- الطلبات تُرسل عبر **واتساب** (لا يوجد خادم/قاعدة بيانات)

**ما كان ينقصه (وكلها بُنيت في 2026-05-18 → 2026-05-19):**
- ✅ تسجيل دخول للزبون (Supabase Auth)
- ✅ قاعدة بيانات للزبائن والطلبات
- ✅ تاريخ الطلبات + customer profile (via RFM views)
- ⏳ إشعارات (push notifications) — Phase 3 لسا
- ⏳ نظام تسويق وعروض — Phase 3 لسا
- ✅ لوحة تحكم للمطعم
- ✅ نظام Template يخدم عدة مطاعم بكود واحد — `/m/[slug]` route

---

## 🎯 الرؤية النهائية

**منصة SaaS اسمها مثلاً "MenuLink" أو "OrderMe" تقدّم:**

| ميزة | للزبون النهائي | للمطعم (عميلك) | لك (المالك) |
|------|-----------|---------|---------|
| قائمة احترافية | ✅ يتصفح ويطلب | ✅ يدير منيوه | — |
| تسجيل دخول بـ OTP | ✅ مرة وحدة | — | — |
| تاريخ الطلبات | ✅ يعيد الطلب بنقرة | ✅ يشوف عملاءه | — |
| Push notifications | ✅ يستقبل عروض | ✅ يرسل عروض | — |
| لوحة تحكم | — | ✅ منيو، طلبات، إحصاءات | ✅ كل العملاء |
| تخصيص كامل | — | ✅ لون، لوجو، اسم، منيو | ✅ تشرف على الكل |
| فوترة شهرية | — | يدفع لك شهرياً | ✅ تجمع الاشتراكات |

---

## 🏗️ المعمارية التقنية المقترحة

```
┌────────────────────────────────────────────────────────────┐
│              العملاء (المطاعم والمقاهي)                    │
│   كل مطعم له subdomain خاص مثل:                            │
│   • koko.menulink.app                                       │
│   • burgerizzr.menulink.app                                 │
│   • starbucks-x.menulink.app                                │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│              FRONTEND  ·  Next.js 14 (React)               │
│   • PWA كامل (يتثبت كتطبيق)                                 │
│   • Server-side rendering للسرعة                            │
│   • نفس الكود يقدّم كل العملاء بـ branding مختلف           │
│   • Hosted on Vercel (مجاني للبداية)                       │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│              BACKEND  ·  Supabase                          │
│   • PostgreSQL database                                     │
│   • Auth (OTP عبر SMS)                                     │
│   • Storage (الصور)                                         │
│   • Realtime (تحديث الطلبات لحظياً)                       │
│   • Row Level Security (عزل بيانات كل مطعم)               │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│              خدمات إضافية                                  │
│   • OneSignal       (push notifications مجاني)             │
│   • Twilio / Unifonic (SMS لـ OTP)                         │
│   • HyperPay / Moyasar (دفع إلكتروني · مدى وفيزا)         │
│   • Resend            (إيميلات تسويقية)                    │
└────────────────────────────────────────────────────────────┘
```

---

## 🗂️ هيكل قاعدة البيانات (Database Schema)

```sql
-- جدول المطاعم (كل عميل من عملائك = صف هنا)
CREATE TABLE restaurants (
  id           uuid PRIMARY KEY,
  slug         text UNIQUE NOT NULL,       -- 'koko', 'burgerizzr'
  name_ar      text NOT NULL,
  name_en      text,
  logo_url     text,
  primary_color text DEFAULT '#D32027',
  bg_color     text DEFAULT '#FAF6EE',
  whatsapp     text NOT NULL,              -- 966500000000
  address      text,
  branch_name  text,
  created_at   timestamptz DEFAULT now(),
  subscription_status text DEFAULT 'trial',-- trial/active/expired
  subscription_end    timestamptz
);

-- أصناف المنيو
CREATE TABLE menu_categories (
  id           uuid PRIMARY KEY,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  name_ar      text NOT NULL,
  emoji        text,
  sort_order   int DEFAULT 0
);

CREATE TABLE menu_items (
  id           uuid PRIMARY KEY,
  category_id  uuid REFERENCES menu_categories(id) ON DELETE CASCADE,
  name_ar      text NOT NULL,
  description  text,
  image_url    text,
  prices       jsonb,                       -- {piece: 20, meal: 24}
  badges       jsonb,                       -- [{type:'hot',label:'حار'}]
  is_active    boolean DEFAULT true,
  sort_order   int DEFAULT 0
);

-- زبائن المنصة (مشترك بين كل المطاعم)
CREATE TABLE customers (
  id           uuid PRIMARY KEY,
  phone        text UNIQUE NOT NULL,
  name         text,
  email        text,
  created_at   timestamptz DEFAULT now(),
  last_order_at timestamptz,
  total_orders int DEFAULT 0,
  total_spent  numeric DEFAULT 0
);

-- عناوين الزبون (يحفظها مرة ويستخدمها كل مرة)
CREATE TABLE customer_addresses (
  id          uuid PRIMARY KEY,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  label       text,                         -- "المنزل" / "المكتب"
  address     text NOT NULL,
  lat         numeric,
  lng         numeric,
  is_default  boolean DEFAULT false
);

-- الطلبات
CREATE TABLE orders (
  id            uuid PRIMARY KEY,
  restaurant_id uuid REFERENCES restaurants(id),
  customer_id   uuid REFERENCES customers(id),
  order_type    text,                       -- delivery/pickup/dinein
  items         jsonb NOT NULL,             -- snapshot of cart
  subtotal      numeric NOT NULL,
  delivery_fee  numeric DEFAULT 0,
  total         numeric NOT NULL,
  address       text,
  location_lat  numeric,
  location_lng  numeric,
  notes         text,
  status        text DEFAULT 'pending',     -- pending/confirmed/preparing/ready/delivered/cancelled
  created_at    timestamptz DEFAULT now()
);

-- العروض والتنبيهات
CREATE TABLE promotions (
  id            uuid PRIMARY KEY,
  restaurant_id uuid REFERENCES restaurants(id),
  title_ar      text,
  body_ar       text,
  discount_code text,
  expires_at    timestamptz,
  target_audience text DEFAULT 'all'        -- all / inactive / new
);

CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY,
  customer_id uuid REFERENCES customers(id),
  endpoint    text,
  keys        jsonb,
  device_info text
);
```

---

## 📋 خطة المراحل (Phased Build)

### المرحلة ١ · PWA (✅ مكتملة الآن)
- ✅ ملف HTML يتثبت كتطبيق
- ✅ يعمل بدون إنترنت
- ✅ منيو، سلة، واتساب، خريطة، QR
- **التكلفة:** ٠ ريال · **الزمن:** انتهت

### المرحلة ٢ · Backend أساسي (٤-٦ أسابيع)
- [ ] إنشاء حساب Supabase وإعداد قاعدة البيانات
- [ ] تحويل المشروع إلى Next.js
- [ ] تسجيل دخول الزبون بـ OTP (SMS)
- [ ] حفظ العناوين والملف الشخصي
- [ ] تاريخ الطلبات + إعادة طلب بنقرة
- [ ] لوحة تحكم بسيطة للمطعم (إدارة منيو + رؤية الطلبات)
- **التكلفة:** ٠ ريال (Free tiers تكفي)

### المرحلة ٣ · إشعارات + تسويق (٤ أسابيع)
- [ ] OneSignal للـ push notifications
- [ ] لوحة المطعم: إنشاء عروض وإرسالها
- [ ] أتمتة "ما طلبت من ٣٠ يوم؟" → إشعار تلقائي
- [ ] نظام النقاط (loyalty points)
- [ ] إرسال SMS للعروض
- **التكلفة:** ٠ - ٥٠ ريال شهرياً (حسب عدد الـ SMS)

### المرحلة ٤ · Multi-Tenant + لوحة الإدارة الرئيسية (٤ أسابيع)
- [ ] Subdomain routing (كل عميل له رابط مستقل)
- [ ] لوحة تحكم رئيسية لك تشوف فيها كل العملاء
- [ ] صفحة "أضف عميل جديد" تأخذ ٥ دقائق بدل ٥ أيام
- [ ] إعدادات الـ branding لكل عميل (لون، لوجو، اسم)
- [ ] نظام فوترة بسيط (Subscription tracking)
- **التكلفة:** ٢٥ ريال شهرياً (Supabase Pro) + ٤٥ ريال سنوياً (نطاق)

### المرحلة ٥ · دفع إلكتروني + تطبيق المطعم (٦ أسابيع)
- [ ] دمج HyperPay أو Moyasar للدفع
- [ ] تطبيق منفصل للمطعم لاستقبال الطلبات (بدل واتساب)
- [ ] طباعة الفواتير
- [ ] إدارة المخزون
- **التكلفة:** ٢.٥٪ من كل عملية دفع (مدفوع للبوابة)

---

## 💰 نموذج العمل المقترح

### أسعار للعملاء (المطاعم):

> ⚠️ **تاريخي — لم يُعتمد.** التسعير المعتمد حالياً: **٥٩ ريال/شهر أو ٤٩٩ ريال/سنة** (المصدر الوحيد: [`PRICING.md`](../../PRICING.md)). الجدول أدناه (٩٩/١٩٩/٣٩٩) من تخطيط مبكر ومحفوظ للمرجع فقط.

| الخطة | السعر الشهري | المناسب لـ |
|------|------------|-----------|
| Starter | ٩٩ ريال | منيو فقط + واتساب + بدون حسابات |
| Pro | ١٩٩ ريال | + حسابات زبائن + إشعارات + إحصاءات |
| Business | ٣٩٩ ريال | + دفع إلكتروني + multiple branches + دعم أولوية |

### حساب الربح (مثال):
- ٢٠ عميل على خطة Pro: **٣٬٩٨٠ ريال شهرياً**
- التكاليف الفعلية: ~٢٠٠ ريال شهرياً (Supabase Pro + Vercel + SMS)
- صافي الربح: **~٣٬٧٨٠ ريال شهرياً**
- على ١٠٠ عميل: **~٢٠٬٠٠٠ ريال شهرياً**

---

## 🛠️ مكدّس التقنيات (Tech Stack)

| الطبقة | الأداة | لماذا |
|------|------|--------|
| Frontend | **Next.js 14** | أسرع framework, PWA-ready, SSR للسرعة |
| UI | **Tailwind CSS + shadcn/ui** | مكتبة مكونات جاهزة وجميلة |
| Backend | **Supabase** | PostgreSQL + Auth + Storage في خدمة واحدة |
| Auth | **Supabase Auth + Twilio** | OTP عبر SMS |
| Push | **OneSignal** | ١٠ ألف مشترك مجاناً |
| Hosting | **Vercel** | نشر تلقائي من Git, CDN عالمي |
| Storage | **Supabase Storage** | للصور |
| Payment | **HyperPay / Moyasar** | محلية، تدعم مدى |
| Analytics | **Plausible / Umami** | بسيط، يحترم الخصوصية |
| Maps | **Leaflet + OpenStreetMap** | مجاني (نفس اللي معنا) |
| SMS | **Unifonic** | محلي سعودي، أسعار جيدة |

---

## 🎨 نظام Template / Multi-Tenant

**الفكرة:** كل عميل جديد = صف واحد في جدول `restaurants` + عدة صفوف في `menu_items`. الكود نفسه.

### مثال على ملف إعدادات العميل:
```json
{
  "slug": "koko",
  "name_ar": "KO-KO Chicky Licky",
  "logo_url": "/logos/koko.svg",
  "theme": {
    "primary": "#D32027",
    "bg": "#FAF6EE",
    "accent": "#FFC619"
  },
  "fonts": {
    "heading": "Tajawal",
    "body": "Cairo"
  },
  "whatsapp": "966500000000",
  "address": "الروضة · طريق عبد الرحمن الغافقي",
  "social": {
    "instagram": "@kokochicky",
    "snapchat": "kokochicky"
  },
  "features": {
    "delivery": true,
    "pickup": true,
    "dinein": true,
    "loyalty_points": true,
    "online_payment": false
  }
}
```

### عملية إضافة عميل جديد تصير:
1. تدخل لوحة الإدارة
2. تضغط "عميل جديد"
3. تعبّي الاسم، اللون، اللوجو، الواتساب
4. ترفع المنيو (CSV أو يدوي)
5. تستلم رابط جاهز: `client-name.menulink.app`
6. **الزمن: ٣٠ دقيقة بدل ٣٠ ساعة**

---

## ⚖️ ماذا أحتاج منك للبدء؟

### قرارات أساسية:
1. **هل ستبني بنفسك أم توظّف مطور؟**
   - بنفسك: يحتاج ٣-٦ أشهر تعلّم وبناء (Next.js, Supabase, React)
   - مع مطور: ٢-٤ أشهر بناء + ٢٠٠٠-٥٠٠٠ ريال شهرياً
   - وكالة: ٣٠٬٠٠٠-٨٠٬٠٠٠ ريال للإطلاق + صيانة

2. **ما اسم المنصة؟** (يأثر على الـ domain والـ branding)

3. **هل تبدأ بـ ٣-٥ عملاء تجريبيين أو تطلق عام؟**

4. **التمويل الذاتي أم تبحث عن مستثمر؟**

### خطوات عملية فورية:
1. سجّل اسم النطاق (`.com` أو `.sa`) — ~٧٠ ريال سنوياً
2. أنشئ حساب على Supabase مجاني — للتجربة
3. أنشئ حساب Vercel — للنشر
4. أنشئ حساب OneSignal — للإشعارات
5. **استمر باستخدام نسخة v6 الحالية مع العملاء الأوائل** لتختبر السوق وتجمع feedback

---

## 🚦 توصيتي العملية لك الآن

**لا تحاول بناء كل شيء دفعة واحدة.** خطوات واقعية:

1. **هذا الشهر:** اطلق v6 (PWA) مع ٣-٥ مطاعم بسعر مغري (٥٠-١٠٠ ريال شهرياً). 
   - اختبر السوق
   - تعلّم احتياجات العملاء الحقيقية
   - ابدأ تجميع feedback

2. **الشهر ٢-٤:** ابني المرحلة ٢ (Backend + Auth + Order history) مع مطور أو بنفسك.
   - حافظ على العملاء القدامى على v6
   - الجدد على v2

3. **الشهر ٥-٨:** المرحلة ٣ والـ ٤ (إشعارات + Multi-tenant).
   - رفع السعر للخدمات الجديدة
   - بدء الخطة Pro والـ Business

4. **سنة كاملة:** تكون عندك ٣٠-٥٠ عميل ودخل شهري ١٠-٢٠ ألف ريال.

---

## 📞 الخطوة التالية في محادثتنا

إذا تبغى تكمل، قول لي:
- **A:** "ابن لي المرحلة ٢ (Next.js + Supabase scaffolding)" → أنشئ لك هيكل المشروع
- **B:** "وضّح لي كذا بأكثر تفصيل: ___" → أشرح أي جزء
- **C:** "بس v6 يكفيني الحين، أبغى أركّز على بيع ٥ عملاء أول" → أساعدك بـ pitch deck وعقد بيع

أنت تبني شيء حقيقي. خذ خطوة واحدة في كل مرة 🚀
