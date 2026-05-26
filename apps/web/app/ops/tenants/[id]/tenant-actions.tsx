"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function TenantActions({
  tenantId,
  isPublished,
  isActive,
  displayOnlyMode = false,
}: {
  tenantId: string;
  isPublished: boolean;
  isActive: boolean;
  displayOnlyMode?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function togglePublished() {
    const sb = createClient();
    const { error } = await sb
      .from("restaurants")
      .update({ is_published: !isPublished })
      .eq("id", tenantId);
    if (error) setMsg(error.message);
    else startTransition(() => router.refresh());
  }

  async function toggleDisplayOnly() {
    const next = !displayOnlyMode;
    const msg = next
      ? "تفعيل وضع العرض فقط؟ سيتم تعطيل جميع الطلبات للعملاء."
      : "إلغاء وضع العرض فقط؟ سيتمكن العملاء من الطلب مرة أخرى.";
    if (!window.confirm(msg)) return;
    const sb = createClient();
    const { error } = await sb
      .from("restaurants")
      .update({ display_only_mode: next })
      .eq("id", tenantId);
    if (error) setMsg(error.message);
    else startTransition(() => router.refresh());
  }

  async function cancelSubscription() {
    if (!window.confirm("إلغاء الاشتراك سيخفي قائمة المطعم عن العملاء. تأكيد؟")) return;
    const sb = createClient();
    const { error } = await sb
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("restaurant_id", tenantId);
    if (error) setMsg(error.message);
    else startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {msg && <span className="text-xs text-red-400 mr-2">{msg}</span>}
      <button
        onClick={togglePublished}
        disabled={pending}
        className="rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-700"
      >
        {isPublished ? "إخفاء" : "نشر"}
      </button>
      <button
        onClick={toggleDisplayOnly}
        disabled={pending}
        className="rounded-md bg-amber-900/40 border border-amber-800 text-amber-300 px-3 py-1.5 text-xs hover:bg-amber-900/60"
      >
        {displayOnlyMode ? "تعطيل وضع العرض" : "وضع العرض فقط"}
      </button>
      <button
        onClick={cancelSubscription}
        disabled={pending}
        className="rounded-md bg-red-900/40 border border-red-800 text-red-300 px-3 py-1.5 text-xs hover:bg-red-900/60"
      >
        إلغاء الاشتراك
      </button>
    </div>
  );
}
