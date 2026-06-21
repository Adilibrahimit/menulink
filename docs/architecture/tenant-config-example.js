// ============================================================================
// مثال على نظام Multi-Tenant
//
// هذا الملف يعرض كيف يصير نفس الكود يخدم عملاء مختلفين.
// كل مطعم له ملف config مستقل، ونفس برنامج Next.js يقرأه ويرسم القائمة.
//
// في الإنتاج: هذه البيانات تكون في قاعدة بيانات Supabase
// (جدول restaurants + menu_items)، مش ملفات JSON.
// ============================================================================

const TENANT_CONFIGS = {

  // ============== العميل ١: KO-KO Chicky Licky ==============
  "koko": {
    slug: "koko",
    name: { ar: "KO-KO Chicky Licky", en: "KO-KO Chicky Licky" },
    tagline: { ar: "طعم ما تقدر تقاومه 🔥", en: "Taste you can't resist" },
    logo: "/logos/koko.svg",
    favicon: "/icons/koko-favicon.png",

    theme: {
      primary:   "#D32027",   // أحمر
      primaryDark: "#A0181D",
      bg:        "#FAF6EE",   // كريمي
      accent:    "#FFC619",   // أصفر
      ink:       "#2A1810",
    },
    fonts: { heading: "Tajawal", body: "Cairo" },

    contact: {
      whatsapp: "966500000000",
      phone:    "966500000000",
      email:    "info@koko.sa",
      instagram: "@kokochicky",
      address:  "الروضة · طريق عبد الرحمن الغافقي",
      branch:   "الفرع الأول"
    },

    features: {
      delivery: true,
      pickup:   true,
      dinein:   true,
      loyalty:  true,
      online_payment: false,    // ندفع كاش حالياً
      multi_branch:   false,
    },

    delivery: {
      min_order:      30,        // ريال
      fee:            10,
      free_above:     100,
      hours: { open: "12:00", close: "02:55" }
    },

    /* المنيو - في الإنتاج يكون في جدول menu_items */
    categories: [
      { id: "broasted", name: "بروستد", emoji: "🍗" },
      { id: "tender",   name: "تندر",   emoji: "🍖" },
      { id: "burger",   name: "برجر",   emoji: "🍔" },
      // ... باقي الأصناف
    ],
  },

  // ============== العميل ٢: Burgerizzr (لو يصير عميلك) ==============
  "burgerizzr": {
    slug: "burgerizzr",
    name: { ar: "برغرايززر", en: "Burgerizzr" },
    tagline: { ar: "Freshness Guaranteed", en: "Freshness Guaranteed" },
    logo: "/logos/burgerizzr.svg",

    theme: {
      primary:   "#D32027",
      primaryDark: "#A0181D",
      bg:        "#F5EFE5",
      accent:    "#FFFFFF",
      ink:       "#2A1810",
    },
    fonts: { heading: "Tajawal", body: "Cairo" },

    contact: {
      whatsapp: "966112229200",
      phone:    "966112229200",
      email:    "info@burgerizzr.com",
      instagram: "@burgerizzr",
      address:  "متعدد الفروع · الرياض",
    },

    features: {
      delivery: true,
      pickup:   true,
      dinein:   true,
      loyalty:  true,
      online_payment: true,
      multi_branch:   true,
    },

    categories: [
      { id: "solo-box",   name: "سولو بوكس", emoji: "📦" },
      { id: "duo",        name: "الديو",      emoji: "👥" },
      { id: "meals",      name: "الوجبات",   emoji: "🍔" },
      // ...
    ],
  },

  // ============== العميل ٣: مقهى (مثال لاختلاف الفئة) ==============
  "cafe-roastery": {
    slug: "cafe-roastery",
    name: { ar: "محمصة القهوة", en: "The Roastery Café" },
    tagline: { ar: "قهوتك المفضّلة بنكهة جديدة ☕", en: "Your favorite coffee, reimagined" },
    logo: "/logos/roastery.svg",

    theme: {
      primary:   "#3D2914",   // بني قهوة
      primaryDark: "#241509",
      bg:        "#F8F4ED",
      accent:    "#C9A86A",
      ink:       "#1A1108",
    },
    fonts: { heading: "Cairo", body: "Cairo" },

    contact: {
      whatsapp: "966555000000",
      address:  "حي الياسمين · الرياض",
    },

    features: {
      delivery: false,           // مقهى بدون توصيل
      pickup:   true,
      dinein:   true,
      loyalty:  true,
      online_payment: false,
    },

    categories: [
      { id: "espresso",  name: "إسبريسو",       emoji: "☕" },
      { id: "filter",    name: "قهوة مقطرة",     emoji: "🫖" },
      { id: "cold",      name: "مشروبات باردة", emoji: "🧊" },
      { id: "pastries",  name: "حلويات",        emoji: "🥐" },
    ],
  },

};

// ============================================================================
// كيف يتم استخدام هذا في Next.js:
//
//   // pages/[tenant]/index.tsx  (في Next.js Pages Router)
//   // أو app/[tenant]/page.tsx  (في App Router)
//
//   export default function MenuPage({ tenant }) {
//     // كل شيء معتمد على ملف الـ config الخاص بالمطعم
//     return (
//       <ThemeProvider theme={tenant.theme} fonts={tenant.fonts}>
//         <AppBar logo={tenant.logo} name={tenant.name.ar} />
//         <Hero tagline={tenant.tagline.ar} />
//         <Menu categories={tenant.categories} />
//         <ContactSection contact={tenant.contact} />
//       </ThemeProvider>
//     );
//   }
//
//   export async function getServerSideProps({ params }) {
//     // قراءة الـ tenant من قاعدة البيانات (Supabase)
//     const tenant = await db.restaurants.findBySlug(params.tenant);
//     if (!tenant) return { notFound: true };
//     return { props: { tenant } };
//   }
//
// النتيجة:
//   • koko.menulink.app          → يحمّل config "koko"
//   • burgerizzr.menulink.app    → يحمّل config "burgerizzr"
//   • cafe-roastery.menulink.app → يحمّل config "cafe-roastery"
//
//   نفس الكود · نفس الـ Next.js app · ثلاث تجارب مختلفة كلياً.
// ============================================================================

module.exports = TENANT_CONFIGS;
