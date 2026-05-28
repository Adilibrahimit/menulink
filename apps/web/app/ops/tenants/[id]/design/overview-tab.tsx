import Link from "next/link";

type ProfileRow = {
  id: string;
  status: string;
  version_number: number;
  published_at: string | null;
  updated_at: string;
  brand: { name_ar: string } | null;
  page: { name_ar: string } | null;
};

export default function OverviewTab({
  tenantId,
  profiles,
}: {
  tenantId: string;
  profiles: ProfileRow[];
}) {
  const published = profiles.find((p) => p.status === "published") ?? null;
  const draft = profiles.find((p) => p.status === "draft") ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-neutral-400">المنشور حالياً</div>
          {published ? (
            <div className="mt-1 text-sm text-neutral-200">
              {published.brand?.name_ar ?? "—"} · v{published.version_number}
              <div className="text-xs text-neutral-500 mt-1">
                {published.published_at
                  ? new Date(published.published_at).toLocaleDateString("ar-SA")
                  : ""}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-neutral-500">لا يوجد ملف منشور</div>
          )}
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs text-neutral-400">المسودة الحالية</div>
          <div className="mt-1 text-sm text-neutral-200">
            {draft ? `${draft.brand?.name_ar ?? "—"} (مسودة)` : "لا توجد مسودة"}
          </div>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        تعديل الاسم/الشعار/الغلاف/الألوان الحالية للقائمة يتم من نموذج «التصميم البصري» في{" "}
        <Link href={`/ops/tenants/${tenantId}`} className="text-neutral-300 underline">
          صفحة المطعم
        </Link>
        .
      </p>
    </div>
  );
}
