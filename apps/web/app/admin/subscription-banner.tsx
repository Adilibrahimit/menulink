import { createClient } from "@/lib/supabase-server";

// Server component that fetches the tenant's subscription and renders a
// status banner above the admin shell when it's anything other than 'active'.
// Owner sees it on every /admin page.
export default async function SubscriptionBanner({ restaurantId }: { restaurantId: string }) {
  const sb = createClient();
  const { data: sub } = await sb
    .from("subscriptions")
    .select("status, plan, amount_sar, current_period_end")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!sub || sub.status === "active") return null;

  const isPending = sub.status === "pending_payment";
  const isOverdue = sub.status === "overdue";
  const isCancelled = sub.status === "cancelled";

  let title = "";
  let body = "";
  let bg = "";

  if (isPending) {
    title = "بانتظار الدفع";
    body = `قم بتحويل ${sub.amount_sar} ر.س لتفعيل المطعم. تواصل مع MenuLink Ops لتأكيد الدفع.`;
    bg = "bg-amber-50 border-amber-200 text-amber-900";
  } else if (isOverdue) {
    title = "الاشتراك متأخر";
    const exp = sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("ar-SA") : "—";
    body = `انتهت فترة الاشتراك في ${exp}. القائمة مخفية عن العملاء حتى تجديد الدفع.`;
    bg = "bg-red-50 border-red-200 text-red-900";
  } else if (isCancelled) {
    title = "الاشتراك ملغي";
    body = "الاشتراك ملغي. لإعادة تفعيل المطعم تواصل مع MenuLink Ops.";
    bg = "bg-red-50 border-red-200 text-red-900";
  }

  return (
    <div className={`rounded-lg border px-4 py-3 mb-4 text-sm ${bg}`}>
      <div className="font-semibold mb-1">⚠️ {title}</div>
      <div>{body}</div>
    </div>
  );
}
