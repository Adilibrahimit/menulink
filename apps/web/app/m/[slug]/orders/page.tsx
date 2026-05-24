import { createClient } from "@/lib/supabase-server";

export default async function CustomerOrdersPage({
  params,
}: {
  params: { slug: string };
}) {
  const sb = createClient();
  const { data: { session } } = await sb.auth.getSession();

  return (
    <div dir="rtl" className="p-4 space-y-4 min-h-[100dvh]" style={{ background: "var(--bg, #fff8f6)" }}>
      <h1 className="text-xl font-extrabold text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
        طلباتي
      </h1>

      {!session ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl">🛒</div>
          <p className="text-sm text-neutral-600">ادخل بحساب Google لرؤية طلباتك السابقة</p>
          <a
            href={`/m/${params.slug}/account`}
            className="inline-block h-10 px-5 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-bold leading-10 hover:bg-neutral-200"
          >
            تسجيل دخول
          </a>
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-3">
          <div className="text-4xl">📦</div>
          <p className="text-sm text-neutral-500">سجل الطلبات قادم قريباً</p>
        </div>
      )}
    </div>
  );
}
