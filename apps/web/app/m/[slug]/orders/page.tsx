import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { buildCssVars, getTheme } from "@/lib/themes";
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

  const cssVars = buildCssVars(params.slug, {
    primary_color: restaurant.primary_color || "#ac0015",
    background_color: restaurant.background_color || "#fff8f6",
  });

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
    events: Array<{
      new_status: string;
      created_at: string;
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
        .select("id, order_type, status, total, notes, created_at, order_items(item_name, variant, qty, unit_price, line_total), order_events(new_status, created_at)")
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
        events: ((o.order_events as Array<Record<string, unknown>>) ?? []).map((e) => ({
          new_status: e.new_status as string,
          created_at: e.created_at as string,
        })),
      }));
    }
  }

  const theme = getTheme(params.slug);

  return (
    <div dir="rtl" style={cssVars} className="min-h-[100dvh] bg-[var(--bg)]">
      {theme.fonts.googleUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={theme.fonts.googleUrl} />
      )}
      <header className="bg-[var(--brand)] text-white px-5 py-4 flex items-center gap-3">
        <a href={`/m/${restaurant.slug}`} className="text-2xl">←</a>
        <h1
          className="font-extrabold text-lg leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          طلباتي
        </h1>
      </header>

      <OrdersClient
        slug={restaurant.slug}
        signedIn={!!user}
        linked={!!customerId}
        orders={orders}
        customerId={customerId}
        restaurantId={restaurant.id}
      />
    </div>
  );
}
