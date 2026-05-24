import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { buildCssVars } from "@/lib/themes";

export default async function PrivacyPage({ params }: { params: { slug: string } }) {
  const sb = createClient();
  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id, slug, name, primary_color, background_color")
    .eq("slug", params.slug)
    .single();
  if (!restaurant) notFound();

  const cssVars = buildCssVars(params.slug, {
    primary_color: restaurant.primary_color || "#ac0015",
    background_color: restaurant.background_color || "#fff8f6",
  });

  return (
    <div dir="rtl" style={cssVars} className="min-h-[100dvh] bg-[var(--bg)]">
      <header className="bg-[var(--brand)] text-white px-5 py-4 flex items-center gap-3">
        <a href={`/m/${params.slug}/account`} className="text-2xl">←</a>
        <h1 className="font-extrabold text-lg" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
          سياسة الخصوصية
        </h1>
      </header>

      <main className="px-5 py-6 prose prose-sm prose-neutral max-w-none text-neutral-800 leading-relaxed" style={{ fontFamily: "Cairo, system-ui, sans-serif" }}>
        <h2>سياسة الخصوصية — {restaurant.name}</h2>
        <p><em>آخر تحديث: ٢٠٢٦/٠٥/٢٥</em></p>

        <h3>١. البيانات التي نجمعها</h3>
        <p>عند استخدام المنصة، قد نجمع البيانات التالية:</p>
        <ul>
          <li><strong>بيانات الحساب:</strong> الاسم، رقم الجوال، البريد الإلكتروني (عند التسجيل بحساب Google).</li>
          <li><strong>بيانات الطلب:</strong> العناصر المطلوبة، المبالغ، عنوان التوصيل، الموقع الجغرافي.</li>
          <li><strong>بيانات الجهاز:</strong> نوع المتصفح، نظام التشغيل (لتحسين تجربة الاستخدام فقط).</li>
        </ul>

        <h3>٢. كيف نستخدم بياناتك</h3>
        <ul>
          <li>تنفيذ ومتابعة طلباتك.</li>
          <li>التواصل معك بخصوص حالة الطلب.</li>
          <li>إرسال إشعارات ترويجية (بموافقتك المسبقة فقط).</li>
          <li>تحسين خدماتنا وتجربة المستخدم.</li>
          <li>الالتزام بالمتطلبات النظامية والقانونية.</li>
        </ul>

        <h3>٣. مشاركة البيانات</h3>
        <p>لا نبيع أو نشارك بياناتك الشخصية مع أطراف ثالثة باستثناء:</p>
        <ul>
          <li>المطعم المعني بتنفيذ طلبك.</li>
          <li>مزودي الخدمات التقنية الضرورية لتشغيل المنصة (استضافة، قاعدة بيانات).</li>
          <li>الجهات الحكومية عند الطلب وفقاً للأنظمة المعمول بها.</li>
        </ul>

        <h3>٤. حماية البيانات</h3>
        <p>نطبق إجراءات أمنية مناسبة لحماية بياناتك، تشمل:</p>
        <ul>
          <li>تشفير البيانات أثناء النقل (HTTPS/TLS).</li>
          <li>التحكم في الوصول على مستوى الصفوف (Row Level Security).</li>
          <li>عدم تخزين بيانات الدفع على خوادمنا.</li>
        </ul>

        <h3>٥. حقوقك</h3>
        <p>وفقاً لنظام حماية البيانات الشخصية في المملكة العربية السعودية (PDPL)، يحق لك:</p>
        <ul>
          <li>الاطلاع على بياناتك الشخصية المحفوظة لدينا.</li>
          <li>طلب تصحيح أو تحديث بياناتك.</li>
          <li>طلب حذف بياناتك الشخصية (حذف الحساب).</li>
          <li>سحب موافقتك على الإشعارات الترويجية في أي وقت.</li>
          <li>تقديم شكوى لدى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).</li>
        </ul>

        <h3>٦. ملفات تعريف الارتباط (Cookies)</h3>
        <p>نستخدم ملفات تعريف الارتباط الضرورية فقط لتشغيل المنصة (جلسة تسجيل الدخول). لا نستخدم ملفات تتبع لأغراض إعلانية.</p>

        <h3>٧. الاحتفاظ بالبيانات</h3>
        <p>نحتفظ ببياناتك طالما حسابك نشط. عند طلب حذف الحساب، تُحذف بياناتك الشخصية خلال ٣٠ يوماً. قد نحتفظ ببيانات الطلبات المجردة من المعلومات الشخصية لأغراض إحصائية.</p>

        <h3>٨. التعديلات</h3>
        <p>قد نحدّث هذه السياسة من وقت لآخر. سنُخطرك بالتغييرات الجوهرية عبر إشعار على المنصة.</p>

        <h3>٩. التواصل</h3>
        <p>لأي استفسار يتعلق بخصوصيتك أو بياناتك، تواصل معنا عبر المطعم مباشرة أو عبر البريد الإلكتروني المسجل في حسابك.</p>

        <hr />
        <p className="text-xs text-neutral-400">هذه السياسة مُعدّة كقالب أولي متوافق مع نظام حماية البيانات الشخصية (PDPL). يُنصح بمراجعتها مع مستشار قانوني قبل الاعتماد النهائي.</p>
      </main>
    </div>
  );
}
