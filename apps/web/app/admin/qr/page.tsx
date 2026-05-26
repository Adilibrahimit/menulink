import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import MenuQR from "@/components/menu-qr";

export default async function AdminQrPage() {
  const me = await requireAdmin();
  const sb = createClient();

  const { data: r } = await sb
    .from("restaurants")
    .select("slug, name, logo_url, tagline_ar, primary_color")
    .eq("id", me.restaurant_id)
    .single();

  if (!r) {
    return (
      <p className="text-sm text-neutral-500 bg-white border border-neutral-200 rounded-xl p-6">
        تعذر تحميل بيانات المطعم.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">رمز QR للقائمة</h1>
      <p className="text-sm text-neutral-500">
        كل مطعم له رمزه الخاص. حمّل البطاقة الجاهزة للطباعة وضعها على الطاولات أو على
        واجهة المحل، أو حمّل رمز QR وحده لتدمجه في تصميمك.
      </p>
      <MenuQR
        slug={r.slug}
        restaurantName={r.name}
        logoUrl={r.logo_url ?? null}
        taglineAr={r.tagline_ar ?? null}
        primaryColor={r.primary_color ?? "#D32027"}
      />
    </div>
  );
}
