import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOps } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import TenantActions from "./tenant-actions";
import DesignForm from "./design-form";
import MenuQR from "@/components/menu-qr";
import { getTheme } from "@/lib/themes";
import AddonManager from "./addon-manager";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "بانتظار الدفع",
  active: "نشط",
  overdue: "متأخر",
  cancelled: "ملغي",
};

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireOps();
  const sb = createClient();

  const [
    { data: r },
    { data: sub },
    { data: payments },
    { data: owners },
    { data: orderCount },
    { data: catalog },
    { data: addons },
  ] = await Promise.all([
    sb.from("restaurants").select("*").eq("id", params.id).single(),
    sb.from("subscriptions").select("*").eq("restaurant_id", params.id).maybeSingle(),
    sb.from("payments")
      .select("id, amount_sar, method, paid_at, reference, notes")
      .order("paid_at", { ascending: false })
      .limit(10),
    sb.rpc("get_tenant_owners", { p_restaurant_id: params.id }),
    sb.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", params.id),
    sb.from("addon_catalog")
      .select("key, name_ar, name_en, description_ar, description_en, category, default_price_sar, trial_days, is_default, sort_order")
      .order("sort_order", { ascending: true }),
    sb.from("subscription_addons")
      .select("addon_key, enabled, trial_ends_at, price_override_sar, notes")
      .eq("restaurant_id", params.id),
  ]);

  if (!r) notFound();

  const ordersTotal = (orderCount as unknown as { count?: number })?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link href="/ops" className="text-xs text-neutral-400 hover:text-neutral-200">← المطاعم</Link>
          <h1 className="text-xl font-bold mt-1">{r.name}</h1>
          <p className="text-xs text-neutral-400 font-mono">{r.slug}</p>
        </div>
        <TenantActions tenantId={r.id} isPublished={r.is_published} isActive={r.is_active} displayOnlyMode={r.display_only_mode ?? false} />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card label="حالة الاشتراك">
          {sub ? STATUS_LABEL[sub.status] : "—"}
          {sub?.plan && (
            <div className="text-xs text-neutral-500 mt-1">
              {sub.plan === "yearly" ? "سنوي" : "شهري"} · {sub.amount_sar} ر.س
            </div>
          )}
        </Card>
        <Card label="آخر دفعة">
          {sub?.last_payment_at ? new Date(sub.last_payment_at).toLocaleDateString("ar-SA") : "لا توجد"}
        </Card>
        <Card label="إجمالي الطلبات">{ordersTotal}</Card>
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-semibold">التصميم البصري</h2>
          <div className="flex items-center gap-3">
            <Link href={`/ops/tenants/${r.id}/design`} className="text-xs text-neutral-300 hover:text-white underline">
              استوديو التصميم →
            </Link>
            <span className="text-[10px] text-neutral-500">ops-only · المالك لا يرى هذه الحقول</span>
          </div>
        </div>
        <DesignForm
          initial={{
            id: r.id,
            name: r.name,
            slug: r.slug,
            logo_url: r.logo_url,
            cover_image_url: r.cover_image_url,
            primary_color: r.primary_color,
            background_color: r.background_color,
          }}
        />
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-semibold">الخدمات (Addons)</h2>
          <span className="text-[10px] text-neutral-500">المالك يرى فقط الخدمات المفعّلة</span>
        </div>
        <AddonManager
          restaurantId={r.id}
          catalog={catalog ?? []}
          initial={addons ?? []}
        />
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-semibold">رمز QR للقائمة</h2>
          <span className="text-[10px] text-neutral-500">يصل المالك إليه أيضاً من /admin/qr</span>
        </div>
        <MenuQR
          slug={r.slug}
          restaurantName={r.name}
          logoUrl={r.logo_url ?? null}
          taglineAr={r.tagline_ar ?? null}
          primaryColor={r.primary_color ?? "#D32027"}
          posterStyle={getTheme(r.slug).posterStyle}
        />
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <h2 className="font-semibold mb-3">معلومات المطعم</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <KV label="رقم واتساب" value={r.whatsapp_phone} />
          <KV label="إيميل التواصل" value={r.contact_email ?? "—"} />
          <KV label="المدينة" value={r.city ?? "—"} />
          <KV label="العنوان" value={r.address_ar ?? "—"} />
          <KV label="الشعار" value={r.tagline_ar ?? "—"} />
          <KV label="منشور" value={r.is_published ? "نعم" : "لا"} />
        </dl>
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">المالكون</h2>
        </div>
        {(owners ?? []).length === 0 && (
          <p className="text-neutral-500 text-sm">لا يوجد مالكون مرتبطون.</p>
        )}
        <ul className="space-y-1 text-sm">
          {(owners ?? []).map((o: any) => (
            <li key={o.user_id} className="flex justify-between text-neutral-300 gap-2 flex-wrap">
              <span>{o.email}</span>
              <span className="text-neutral-500 text-xs">
                {o.role}
                {o.last_sign_in_at && (
                  <> · آخر دخول {new Date(o.last_sign_in_at).toLocaleDateString("ar-SA")}</>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">آخر الدفعات</h2>
          <Link href={`/ops/payments?tenant=${r.id}`} className="text-xs text-neutral-400 hover:text-neutral-100">
            + سجّل دفعة
          </Link>
        </div>
        {(payments ?? []).length === 0 && (
          <p className="text-neutral-500 text-sm">لا توجد دفعات.</p>
        )}
        <ul className="divide-y divide-neutral-800">
          {(payments ?? []).map((p: any) => (
            <li key={p.id} className="py-2 flex justify-between text-sm">
              <span>{p.amount_sar} ر.س · {p.method}</span>
              <span className="text-neutral-500">{new Date(p.paid_at).toLocaleDateString("ar-SA")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-lg font-semibold text-neutral-100 mt-1">{children}</div>
    </div>
  );
}
function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{value}</dd>
    </>
  );
}
