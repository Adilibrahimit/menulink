import Link from "next/link";

const FEATURES = [
  { icon: "📱", title: "قائمة رقمية احترافية", body: "تثبت كتطبيق على جوال الزبون. سريعة، تشتغل أوفلاين، عربية بالكامل." },
  { icon: "💬", title: "طلبات عبر واتساب", body: "كل طلب يصلك على واتساب مع كل التفاصيل، بدون احتياج لتطبيق توصيل." },
  { icon: "📊", title: "تحليلات عملاءك", body: "شوف العملاء الأكثر ولاءً، اللي ابتعدوا، والأصناف الأكثر طلباً تلقائياً." },
  { icon: "🔔", title: "تحديثات فورية", body: "كل طلب جديد يظهر في لوحة التحكم فوراً — بدون تحديث الصفحة." },
  { icon: "🎨", title: "ألوان مطعمك", body: "اضبط هوية مطعمك (الشعار، الألوان، الخط). القائمة تعكس برندك." },
  { icon: "🇸🇦", title: "صُمم للسوق السعودي", body: "RTL، أرقام عربية، واتساب، مدى، تحويل بنكي. كل شي محلي." },
];

const PRICING = [
  {
    plan: "شهري",
    price: "٥٩",
    suffix: "ر.س / شهر",
    desc: "ابدأ بدون التزام طويل",
    highlight: false,
  },
  {
    plan: "سنوي",
    price: "٤٩٩",
    suffix: "ر.س / سنة",
    desc: "وفّر ٢٠٩ ر.س — يعادل ٤١.٥ ر.س شهرياً",
    highlight: true,
  },
];

export default function Home() {
  return (
    <main dir="rtl" className="min-h-screen bg-brand-bg text-neutral-900">
      {/* Hero */}
      <section className="px-6 pt-16 pb-12 max-w-5xl mx-auto text-center">
        <div className="inline-block px-3 py-1 rounded-full bg-white border border-neutral-200 text-xs text-neutral-600 mb-6">
          منصة قوائم وطلبات للمطاعم السعودية
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-neutral-900 mb-4">
          مطعمك يستحق <span className="text-brand-primary">قائمة احترافية</span>
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
          MenuLink منصة كاملة: قائمة رقمية، طلبات واتساب، تحليلات عملاء، ولوحة تحكم للمطعم — بأقل من نصف سعر المنافسين.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://wa.me/966500000000?text=أهلاً%20MenuLink،%20أبغى%20أبدأ%20تجربة%20لمطعمي"
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md bg-brand-primary text-white px-6 py-3 font-semibold hover:opacity-90"
          >
            ابدأ مع MenuLink
          </a>
          <Link
            href="/admin/login"
            className="inline-block rounded-md bg-white border border-neutral-300 text-neutral-700 px-6 py-3 font-semibold hover:bg-neutral-50"
          >
            دخول مالك مطعم
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
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

      {/* Pricing */}
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-2">سعر بسيط وواضح</h2>
        <p className="text-center text-neutral-600 mb-8">
          بدون عمولات على الطلبات. بدون رسوم إعداد. ادفع شهرياً أو سنوياً، إلغاء في أي وقت.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRICING.map((p) => (
            <div
              key={p.plan}
              className={
                p.highlight
                  ? "bg-white border-2 border-brand-primary rounded-2xl p-6 shadow-md"
                  : "bg-white border border-neutral-200 rounded-2xl p-6"
              }
            >
              {p.highlight && (
                <div className="inline-block text-xs px-2 py-0.5 rounded-full bg-brand-primary text-white mb-2">
                  الأكثر طلباً
                </div>
              )}
              <h3 className="font-bold text-neutral-900 mb-1">{p.plan}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-extrabold">{p.price}</span>
                <span className="text-neutral-500 text-sm">{p.suffix}</span>
              </div>
              <p className="text-sm text-neutral-600">{p.desc}</p>
            </div>
          ))}
        </div>
        <ul className="mt-8 space-y-2 text-sm text-neutral-700">
          <li>✓ قائمة رقمية كاملة (يستضافها MenuLink — بدون قلق)</li>
          <li>✓ طلبات لا محدودة عبر واتساب</li>
          <li>✓ لوحة تحكم للمطعم: تعديل القائمة، رؤية الطلبات، تحليلات العملاء</li>
          <li>✓ تحديثات تلقائية + استضافة مدفوعة</li>
          <li>✓ دعم فني عبر واتساب</li>
        </ul>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-3">جاهز تبدأ؟</h2>
        <p className="text-neutral-600 mb-6">
          راسلنا على واتساب وخل MenuLink ينطلق لمطعمك في أقل من ٢٤ ساعة.
        </p>
        <a
          href="https://wa.me/966500000000?text=أهلاً%20MenuLink،%20أبغى%20أبدأ"
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-md bg-brand-primary text-white px-8 py-4 font-bold hover:opacity-90"
        >
          💬 ابدأ على واتساب
        </a>
      </section>

      <footer className="px-6 py-8 text-center text-xs text-neutral-500 border-t border-neutral-200">
        <div>MenuLink © 2026 · صنع في الرياض 🇸🇦</div>
        <div className="mt-2 space-x-4 space-x-reverse">
          <Link href="/admin/login" className="hover:text-neutral-700">دخول المطاعم</Link>
          <Link href="/ops/login" className="hover:text-neutral-700">دخول المنصة</Link>
        </div>
      </footer>
    </main>
  );
}
