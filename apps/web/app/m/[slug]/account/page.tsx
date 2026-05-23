import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import AccountClient from "./account-client";

const TIER_LABEL: Record<string, string> = {
  bronze:   "🥉 برونزي",
  silver:   "🥈 فضي",
  gold:     "🥇 ذهبي",
  platinum: "💎 بلاتيني",
};

export default async function CustomerAccountPage({
  params,
}: {
  params: { slug: string };
}) {
  const sb = createClient();

  // Resolve tenant — same RPC the menu page uses.
  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id, slug, name, primary_color, background_color, logo_url")
    .eq("slug", params.slug)
    .single();
  if (!restaurant) notFound();

  // Account page is loyalty-feature-only. If addon off, 404.
  if (!(await hasAddon(restaurant.id, "loyalty"))) notFound();

  const cssVars = {
    "--brand": restaurant.primary_color || "#ac0015",
    "--bg":    restaurant.background_color || "#fff8f6",
    "--ink":   "#29170f",
  } as React.CSSProperties;

  // Fetch current user (Google-signed-in customer, owner, or none).
  const { data: { user } } = await sb.auth.getUser();

  // If signed in, look up this customer's row for THIS tenant.
  let customer: {
    id: string;
    name: string | null;
    phone: string;
    loyalty_points_balance: number;
    loyalty_lifetime_points: number;
    loyalty_tier: string;
    orders_count: number;
  } | null = null;
  let recentOrders: Array<{ id: string; total: number; created_at: string; status: string }> = [];

  if (user) {
    const { data: c } = await sb
      .from("customers")
      .select("id, name, phone, loyalty_points_balance, loyalty_lifetime_points, loyalty_tier, orders_count")
      .eq("auth_user_id", user.id)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    customer = c
      ? {
          id: c.id as string,
          name: (c.name as string | null) ?? null,
          phone: c.phone as string,
          loyalty_points_balance: Number(c.loyalty_points_balance ?? 0),
          loyalty_lifetime_points: Number(c.loyalty_lifetime_points ?? 0),
          loyalty_tier: (c.loyalty_tier as string) ?? "bronze",
          orders_count: Number(c.orders_count ?? 0),
        }
      : null;

    if (customer) {
      const { data: orders } = await sb
        .from("orders")
        .select("id, total, created_at, status")
        .eq("customer_id", customer.id)
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(20);
      recentOrders = (orders ?? []).map((o) => ({
        id: o.id as string,
        total: Number(o.total ?? 0),
        created_at: o.created_at as string,
        status: o.status as string,
      }));
    }
  }

  return (
    <div dir="rtl" style={cssVars} className="min-h-[100dvh] bg-[var(--bg)]">
      <header className="bg-[var(--brand)] text-white px-5 py-4 flex items-center gap-3">
        <a href={`/m/${restaurant.slug}`} className="text-2xl">←</a>
        <div className="flex-1 min-w-0">
          <h1
            className="font-extrabold text-lg leading-tight truncate"
            style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
          >
            حسابي · {restaurant.name}
          </h1>
        </div>
      </header>

      <main className="px-4 py-5 space-y-4">
        <AccountClient
          slug={restaurant.slug}
          tenantName={restaurant.name}
          signedIn={!!user}
          userEmail={user?.email ?? null}
          userName={(user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? null}
          customer={customer}
          recentOrders={recentOrders}
          tierLabel={customer ? TIER_LABEL[customer.loyalty_tier] ?? customer.loyalty_tier : null}
        />
      </main>
    </div>
  );
}
