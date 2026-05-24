import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function TermsPage({ params }: { params: { slug: string } }) {
  const sb = createClient();
  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id, slug, name, primary_color, background_color")
    .eq("slug", params.slug)
    .single();
  if (!restaurant) notFound();

  const cssVars = {
    "--brand": restaurant.primary_color || "#ac0015",
    "--bg": restaurant.background_color || "#fff8f6",
  } as React.CSSProperties;

  return (
    <div dir="rtl" style={cssVars} className="min-h-[100dvh] bg-[var(--bg)]">
      <header className="bg-[var(--brand)] text-white px-5 py-4 flex items-center gap-3">
        <a href={`/m/${params.slug}/account`} className="text-2xl">←</a>
        <h1 className="font-extrabold text-lg" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
          الشروط والأحكام
        </h1>
      </header>

      <main className="px-5 py-6 prose prose-sm prose-neutral max-w-none text-neutral-800 leading-relaxed" style={{ fontFamily: "Cairo, system-ui, sans-serif" }}>
        <h2>الشروط والأحكام — {restaurant.name}</h2>
        <p><em>آخر تحديث: ٢٠٢٦/٠٥/٢٥</em></p>

        <h3>١. القبول</h3>
        <p>باستخدامك لمنصة {restaurant.name} عبر MenuLink، فإنك توافق على هذه الشروط والأحكام. في حال عدم الموافقة، يرجى عدم استخدام الخدمة.</p>

        <h3>٢. وصف الخدمة</h3>
        <p>توفر المنصة خدمة عرض قائمة الطعام وتقديم الطلبات إلكترونياً لصالح {restaurant.name}. الطلبات تُرسل مباشرة للمطعم ويتم التأكيد من قبل فريق المطعم.</p>

        <h3>٣. الأسعار والدفع</h3>
        <ul>
          <li>جميع الأسعار معروضة بالريال السعودي وشاملة لضريبة القيمة المضافة (١٥٪) ما لم يُذكر خلاف ذلك.</li>
          <li>قد تتغير الأسعار دون إشعار مسبق.</li>
          <li>الدفع يتم حسب الطرق المتاحة في المطعم (نقداً، بطاقة، أو عبر وسائل الدفع الإلكترونية المتاحة).</li>
        </ul>

        <h3>٤. الطلبات والإلغاء</h3>
        <ul>
          <li>بمجرد تأكيد الطلب من المطعم، لا يمكن إلغاؤه إلا بالتواصل المباشر مع المطعم.</li>
          <li>يحق للمطعم رفض أو إلغاء أي طلب لأسباب تشغيلية.</li>
          <li>في حالة إلغاء الطلب من قبل المطعم بعد الدفع، يتم استرداد المبلغ كاملاً.</li>
        </ul>

        <h3>٥. التوصيل</h3>
        <ul>
          <li>أوقات التوصيل تقديرية وقد تتأثر بالظروف التشغيلية أو الطقس.</li>
          <li>يجب تقديم عنوان توصيل صحيح ودقيق. المطعم غير مسؤول عن التأخير الناتج عن عنوان غير صحيح.</li>
          <li>رسوم التوصيل (إن وجدت) تُعرض قبل تأكيد الطلب.</li>
        </ul>

        <h3>٦. جودة المنتجات</h3>
        <p>يلتزم المطعم بمعايير الهيئة العامة للغذاء والدواء (SFDA) لسلامة الغذاء. في حال وجود شكوى تتعلق بجودة المنتج، يرجى التواصل مع المطعم خلال ساعتين من الاستلام.</p>

        <h3>٧. المعلومات الغذائية والحساسية</h3>
        <ul>
          <li>المعلومات الغذائية (السعرات الحرارية، مسببات الحساسية) المعروضة هي قيم تقديرية وفقاً لمتطلبات SFDA.</li>
          <li>إذا كنت تعاني من حساسية غذائية، يرجى إبلاغ المطعم مباشرة قبل تقديم الطلب.</li>
        </ul>

        <h3>٨. حقوق المستهلك</h3>
        <p>وفقاً لنظام حماية المستهلك في المملكة العربية السعودية:</p>
        <ul>
          <li>يحق لك الحصول على معلومات واضحة وصحيحة عن المنتجات والأسعار.</li>
          <li>يحق لك تقديم شكوى عبر وزارة التجارة (الرقم الموحد: 1900) أو تطبيق بلاغ تجاري.</li>
          <li>يحق لك استرداد أموالك في حال عدم تقديم الخدمة المتفق عليها.</li>
        </ul>

        <h3>٩. القانون المعمول به</h3>
        <p>تخضع هذه الشروط لأنظمة المملكة العربية السعودية. أي نزاع يُحل أمام الجهات القضائية المختصة في المملكة.</p>

        <h3>١٠. التعديلات</h3>
        <p>يحق لنا تعديل هذه الشروط في أي وقت. التعديلات تسري فور نشرها على المنصة.</p>

        <hr />
        <p className="text-xs text-neutral-400">هذه الشروط مُعدّة كقالب أولي. يُنصح بمراجعتها مع مستشار قانوني قبل الاعتماد النهائي.</p>
      </main>
    </div>
  );
}
