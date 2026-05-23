import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import TablesEditor from "./tables-editor";

export default async function AdminTablesPage() {
  const me = await requireOwner();
  const sb = createClient();

  const [{ data: r }, { data: tables }] = await Promise.all([
    sb
      .from("restaurants")
      .select("slug, name, logo_url, tagline_ar, primary_color")
      .eq("id", me.restaurant_id)
      .single(),
    sb
      .from("restaurant_tables")
      .select("id, label, sort_order, created_at")
      .eq("restaurant_id", me.restaurant_id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (!r) {
    return (
      <p className="text-sm text-neutral-500 bg-white border border-neutral-200 rounded-xl p-6">
        تعذر تحميل بيانات المطعم.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">طاولات المطعم</h1>
      <p className="text-sm text-neutral-500">
        أضف كل طاولة في المطعم. كل طاولة تحصل على رمز QR خاص بها — العميل يجلس،
        يمسح، تفتح القائمة وطلبه يصلك مع رقم الطاولة.
      </p>
      <TablesEditor
        restaurantId={me.restaurant_id}
        restaurantName={r.name}
        slug={r.slug}
        logoUrl={r.logo_url ?? null}
        taglineAr={r.tagline_ar ?? null}
        primaryColor={r.primary_color ?? "#D32027"}
        initialTables={tables ?? []}
      />
    </div>
  );
}
