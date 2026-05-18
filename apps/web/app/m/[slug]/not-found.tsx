import Link from "next/link";

// Rendered when get_public_menu(slug) returns null — either the slug doesn't
// exist, the tenant isn't published, or the subscription is overdue and the
// trigger flipped is_published=false.
export default function NotFound() {
  return (
    <main
      dir="rtl"
      className="min-h-[100dvh] bg-brand-bg flex items-center justify-center px-6"
    >
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🍽️</div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          القائمة غير متاحة
        </h1>
        <p className="text-sm text-neutral-600 leading-relaxed">
          هذا المطعم غير منشور حالياً أو الرابط غير صحيح.
          تأكّد من العنوان أو تواصل مع المطعم مباشرة.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 text-sm text-brand-primary font-semibold hover:underline"
        >
          عودة للصفحة الرئيسية ←
        </Link>
      </div>
    </main>
  );
}
