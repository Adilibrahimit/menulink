import { requireOps } from "@/lib/auth";
import NewTenantForm from "./new-tenant-form";

export default async function NewTenantPage() {
  await requireOps();
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">إضافة مطعم جديد</h1>
      <p className="text-sm text-neutral-400">
        الـ wizard ينشئ صف المطعم + حساب المالك + الاشتراك بحالة "بانتظار الدفع".
        ستحصل على كلمة مرور توقّتية تشاركها مع المالك عبر واتساب. هو يغيّرها أول مرة يدخل فيها.
      </p>
      <NewTenantForm />
    </div>
  );
}
