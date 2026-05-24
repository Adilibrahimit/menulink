import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import OrdersClient from "./orders-client";

export default async function CustomerOrdersPage({
  params,
}: {
  params: { slug: string };
}) {
  const sb = createClient();

  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id, slug, name, primary_color, background_color, whatsapp_phone")
    .eq("slug", params.slug)
    .single();
  if (!restaurant) notFound();

  const cssVars = {
    "--brand": restaurant.primary_color || "#ac0015",
    "--bg": restaurant.background_color || "#fff8f6",
  } as React.CSSProperties;

  const { data: { user } } = await sb.auth.getUser();

  let customerId: string | null = null;
  let orders: Array<{
    id: string;
    order_type: string;
    status: string;
    total: number;
    notes: string | null;
    created_at: string;
    items: Array<{
      item_name: string;
      variant: string | null;
      qty: number;
      unit_price: number;
      line_total: number;
    }>;
  }> = [];

  if (user) {
    let { data: c } = await sb
      .from("customers")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();

    // Cross-tenant auto-link via RPC
    if (!c) {
      const { data: result } = await sb.rpc("auto_link_customer", { p_restaurant_id: restaurant.id });
      const r = result as { ok: boolean; customer_id?: string } | null;
      if (r?.ok && r.customer_id) {
        c = { id: r.customer_id };
      }
    }

    customerId = c?.id as string | null;

    if (customerId) {
      const { data: rawOrders } = await sb
        .from("orders")
        .select("id, order_type, status, total, notes, created_at, order_items(item_name, variant, qty, unit_price, line_total)")
        .eq("customer_id", customerId)
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(50);

      orders = (rawOrders ?? []).map((o) => ({
        id: o.id as string,
        order_type: o.order_type as string,
        status: o.status as string,
        total: Number(o.total ?? 0),
        notes: (o.notes as string | null) ?? null,
        created_at: o.created_at as string,
        items: ((o.order_items as Array<Record<string, unknown>>) ?? []).map((i) => ({
          item_name: i.item_name as string,
          variant: (i.variant as string | null) ?? null,
          qty: Number(i.qty ?? 1),
          unit_price: Number(i.unit_price ?? 0),
          line_total: Number(i.line_total ?? 0),
        })),
      }));
    }
  }

  return (
    <div dir="rtl" style={cssVars} className="min-h-[100dvh] bg-[var(--bg)]">
      <header className="bg-[var(--brand)] text-white px-5 py-4 flex items-center gap-3">
        <a href={`/m/${restaurant.slug}`} className="text-2xl">←</a>
        <h1
          className="font-extrabold text-lg leading-tight"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          طلباتي
        </h1>
      </header>

      <OrdersClient
        slug={restaurant.slug}
        signedIn={!!user}
        linked={!!customerId}
        orders={orders}
      />
    </div>
  );
}
