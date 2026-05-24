import Link from "next/link";
import Image from "next/image";

const FEATURES = [
  { icon: "📱", title: "قائمة رقمية احترافية", body: "تثبت كتطبيق على جوال الزبون. سريعة، تشتغل أوفلاين، عربية بالكامل مع تصميم يعكس هوية مطعمك." },
  { icon: "💬", title: "طلبات عبر واتساب", body: "كل طلب يوصلك على واتساب مع التفاصيل كاملة — بدون عمولات وبدون تطبيقات توصيل." },
  { icon: "🚗", title: "أنواع طلبات متعددة", body: "توصيل، استلام من الفرع، تناول في المطعم، واستلام بالسيارة (Curbside) مع زر 'وصلت'." },
  { icon: "📊", title: "تحليلات عملاء RFM", body: "شوف عملاءك الأوفياء، اللي ابتعدوا، والجدد. تصنيف تلقائي بحسب تكرار الشراء والقيمة." },
  { icon: "🏆", title: "نظام ولاء ومكافآت", body: "نقاط على كل طلب، مستويات (برونزي-بلاتيني)، ومكافآت يستبدلها الزبون من حسابه." },
  { icon: "🔔", title: "إشعارات Push", body: "أرسل عروض وتنبيهات مباشرة لجوال زبائنك. استهداف ذكي حسب شريحة العميل (RFM)." },
  { icon: "🪑", title: "طلبات الطاولات (QR)", body: "طبّق QR لكل طاولة. الزبون يمسح ويطلب من مكانه — طلبه مربوط بالطاولة تلقائياً." },
  { icon: "🎨", title: "تصميم مخصص لكل مطعم", body: "ألوان، خطوط، ثيم كامل يعكس برند مطعمك. كل عميل يشوف تجربة مختلفة." },
  { icon: "📍", title: "خرائط وعناوين محفوظة", body: "الزبون يحدد موقعه بالخريطة أو يختار من عناوينه المحفوظة — توصيل أسرع وأدق." },
  { icon: "🔥", title: "معلومات غذائية (SFDA)", body: "سعرات حرارية، مسببات حساسية، صوديوم وكافيين — متوافق مع متطلبات هيئة الغذاء والدواء." },
  { icon: "👤", title: "حسابات العملاء", body: "تسجيل دخول بـ Google أو كزائر. حفظ الطلبات السابقة، النقاط، والعناوين تلقائياً." },
  { icon: "🇸🇦", title: "صُمم للسوق السعودي", body: "عربي أولاً، RTL، أرقام عربية، واتساب، توقيت الرياض. كل شي محلي من البداية." },
];

const ADMIN_FEATURES = [
  "إدارة كاملة للقائمة: أصناف، تصنيفات، أسعار، متغيرات، صور",
  "متابعة الطلبات لحظياً (Realtime) — بدون تحديث الصفحة",
  "إدارة العملاء مع تصنيف RFM تلقائي",
  "نظام ولاء: إعدادات النقاط، المكافآت، الاستبدالات",
  "بث إشعارات Push لشرائح محددة من العملاء",
  "إدارة الطاولات وأكواد QR",
  "تعديل معلومات المطعم: ساعات العمل، العنوان، التواصل",
  "تصدير بيانات العملاء والطلبات (CSV)",
];

export default function Home() {
  return (
    <main dir="rtl" className="min-h-screen bg-brand-bg text-neutral-900">
      {/* Hero */}
      <section className="px-6 pt-16 pb-12 max-w-5xl mx-auto text-center">
        <Image src="/menulink-logo.png" alt="MenuLink" width={120} height={120} className="rounded-3xl mx-auto mb-6 shadow-lg ring-1 ring-neutral-200" />
        <div className="inline-block px-3 py-1 rounded-full bg-white border border-neutral-200 text-xs text-neutral-600 mb-6">
          منصة قوائم وطلبات للمطاعم السعودية
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-neutral-900 mb-4">
          مطعمك يستحق <span className="text-brand-primary">قائمة احترافية</span>
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
          MenuLink منصة كاملة: قائمة رقمية، طلبات واتساب، نظام ولاء، تحليلات عملاء، إشعارات Push، ولوحة تحكم شاملة — كل ما يحتاجه مطعمك في مكان واحد.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://wa.me/966504744517?text=أهلاً%20MenuLink،%20أبغى%20أعرف%20أكثر%20عن%20المنصة"
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md bg-brand-primary text-white px-6 py-3 font-semibold hover:opacity-90"
          >
            💬 تواصل واتساب
          </a>
          <a
            href="mailto:id.menulink@gmail.com?subject=استفسار عن MenuLink"
            className="inline-block rounded-md bg-white border border-neutral-300 text-neutral-700 px-6 py-3 font-semibold hover:bg-neutral-50"
          >
            📧 راسلنا بالإيميل
          </a>
          <Link
            href="/admin/login"
            className="inline-block rounded-md bg-white border border-neutral-300 text-neutral-700 px-6 py-3 font-semibold hover:bg-neutral-50"
          >
            دخول مالك مطعم
          </Link>
        </div>
      </section>

      {/* Features — Customer Experience */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-2">تجربة عميل متكاملة</h2>
        <p className="text-center text-neutral-600 mb-8">كل ما يحتاجه زبونك من لحظة فتح القائمة إلى استلام الطلب</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white border border-neutral-200 rounded-xl p-5">
              <div className="text-3xl mb-2">{f.icon}</div>
              <h3 className="font-semibold text-neutral-900 mb-1">{f.title}</h3>
              <p className="text-sm text-neutral-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features — Admin Dashboard */}
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-2">لوحة تحكم قوية للمطعم</h2>
        <p className="text-center text-neutral-600 mb-8">أدِر مطعمك بالكامل من مكان واحد</p>
        <div className="bg-white border border-neutral-200 rounded-2xl p-6">
          <ul className="space-y-3">
            {ADMIN_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-neutral-700">
                <span className="text-brand-primary mt-0.5 shrink-0">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing → Contact */}
      <section className="px-6 py-16 max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-3">الأسعار</h2>
        <p className="text-neutral-600 mb-8 max-w-xl mx-auto">
          نقدم باقات مرنة تناسب حجم مطعمك واحتياجاتك. تواصل مع فريق MenuLink لمعرفة الباقة المناسبة لك.
        </p>
        <div className="bg-white border-2 border-brand-primary rounded-2xl p-8 max-w-md mx-auto space-y-4">
          <div className="text-5xl">💬</div>
          <h3 className="text-xl font-extrabold text-neutral-900">تواصل معنا للتسعير</h3>
          <p className="text-sm text-neutral-600">
            راسلنا وبنوصلك بالباقة اللي تناسب مطعمك — بدون التزام.
          </p>
          <a
            href="https://wa.me/966504744517?text=أهلاً%20MenuLink،%20أبغى%20أعرف%20الأسعار"
            target="_blank"
            rel="noreferrer"
            className="inline-block w-full rounded-xl bg-brand-primary text-white px-6 py-3 font-bold hover:opacity-90"
          >
            💬 واتساب
          </a>
          <a
            href="mailto:id.menulink@gmail.com?subject=استفسار عن أسعار MenuLink"
            className="inline-block w-full rounded-xl bg-white border-2 border-neutral-300 text-neutral-700 px-6 py-3 font-bold hover:bg-neutral-50"
          >
            📧 id.menulink@gmail.com
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-3">جاهز تبدأ؟</h2>
        <p className="text-neutral-600 mb-6">
          راسلنا وخل MenuLink ينطلق لمطعمك في أقل من ٢٤ ساعة.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://wa.me/966504744517?text=أهلاً%20MenuLink،%20أبغى%20أبدأ"
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md bg-brand-primary text-white px-8 py-4 font-bold hover:opacity-90"
          >
            💬 ابدأ على واتساب
          </a>
          <a
            href="mailto:id.menulink@gmail.com?subject=أبغى أبدأ مع MenuLink"
            className="inline-block rounded-md bg-white border border-neutral-300 text-neutral-700 px-8 py-4 font-bold hover:bg-neutral-50"
          >
            📧 راسلنا بالإيميل
          </a>
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-xs text-neutral-500 border-t border-neutral-200">
        <div>MenuLink © 2026 · صنع في الرياض 🇸🇦</div>
        <div className="mt-2">
          <Link href="/admin/login" className="hover:text-neutral-700">دخول المطاعم</Link>
        </div>
      </footer>
    </main>
  );
}
