"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type CustomerInfo = { name: string | null; phone: string };
type OrderRow = {
  id: string;
  order_type: string;
  channel: string;
  status: string;
  subtotal: string;
  delivery_fee: string;
  total: string;
  address: string | null;
  notes: string | null;
  created_at: string;
  customers: CustomerInfo | CustomerInfo[] | null;
};

const STATUSES = ["submitted", "confirmed", "preparing", "ready", "delivered", "cancelled"] as const;
const STATUS_LABEL_AR: Record<string, string> = {
  submitted: "جديد",
  confirmed: "مؤكد",
  preparing: "تجهيز",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};
const ORDER_TYPE_LABEL: Record<string, string> = {
  delivery: "توصيل",
  pickup: "استلام",
  dine_in: "في المطعم",
};

function getCustomer(o: OrderRow): CustomerInfo | null {
  if (!o.customers) return null;
  return Array.isArray(o.customers) ? o.customers[0] ?? null : o.customers;
}

export default function OrdersLive({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: OrderRow[];
}) {
  const [rows, setRows] = useState<OrderRow[]>(initial);

  useEffect(() => {
    const sb = createClient();

    // Realtime: insert events bring new orders to the top of the list.
    // When a new order arrives, fetch its joined customer row (the realtime
    // payload doesn't include the join).
    const channel = sb
      .channel(`orders:${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          const fresh = payload.new as OrderRow;
          const { data: cust } = await sb
            .from("customers")
            .select("name, phone")
            .eq("id", (fresh as any).customer_id)
            .single();
          setRows((r) => [{ ...fresh, customers: cust as any }, ...r].slice(0, 100));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const fresh = payload.new as OrderRow;
          setRows((r) => r.map((o) => (o.id === fresh.id ? { ...o, ...fresh } : o)));
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [restaurantId]);

  async function setStatus(id: string, status: string) {
    const sb = createClient();
    await sb.from("orders").update({ status }).eq("id", id);
    // Optimistic local update; the Realtime UPDATE event will mirror it.
    setRows((r) => r.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  if (rows.length === 0) {
    return <p className="text-neutral-500 text-sm">لا توجد طلبات بعد.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((o) => {
        const cust = getCustomer(o);
        return (
          <li key={o.id} className="bg-white border border-neutral-200 rounded-xl p-3 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="font-semibold">
                {cust?.name ?? "—"} <span className="text-neutral-400 font-normal">· {cust?.phone ?? "—"}</span>
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {new Date(o.created_at).toLocaleString("ar-SA")} · {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}
              </div>
              {o.address && <div className="text-xs text-neutral-600 mt-1">📍 {o.address}</div>}
              {o.notes && <div className="text-xs text-amber-700 mt-1">📝 {o.notes}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-brand-primary">{o.total} ر.س</span>
              <select
                value={o.status}
                onChange={(e) => setStatus(o.id, e.target.value)}
                className="text-xs border border-neutral-300 rounded px-2 py-1 outline-none focus:border-brand-primary"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL_AR[s]}
                  </option>
                ))}
              </select>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
