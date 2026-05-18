import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import InfoForm from "./info-form";
import type { Restaurant } from "@/lib/types";

export default async function InfoPage() {
  const me = await requireOwner();
  const sb = createClient();
  const { data: restaurant, error } = await sb
    .from("restaurants")
    .select("*")
    .eq("id", me.restaurant_id)
    .single();

  if (error || !restaurant) {
    return <p className="text-red-700">تعذّر تحميل بيانات المطعم: {error?.message}</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">معلومات المطعم</h1>
      <p className="text-sm text-neutral-500">
        هذه البيانات تظهر للعميل في صفحة القائمة. أي تعديل ينطبق فوراً عند تحديث الصفحة.
      </p>
      <InfoForm initial={restaurant as Restaurant} />
    </div>
  );
}
