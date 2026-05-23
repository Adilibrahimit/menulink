import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import RewardsClient from "./rewards-client";

type CustomerView = {
  id: string;
  loyalty_points_balance: number;
  loyalty_tier: "bronze" | "silver" | "gold" | "platinum";
};

export default async function CustomerRewardsPage({ params }: { params: { slug: string } }) {
  const sb = createClient();

  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id, slug, name, primary_color, background_color, logo_url")
    .eq("slug", params.slug)
    .single();
  if (!restaurant) notFound();
  if (!(await hasAddon(restaurant.id, "loyalty"))) notFound();

  const cssVars = {
    "--brand": restaurant.primary_color || "#ac0015",
    "--bg":    restaurant.background_color || "#fff8f6",
    "--ink":   "#29170f",
  } as React.CSSProperties;

  // Active rewards for this tenant (anon read allowed by RLS).
  const { data: rewards } = await sb
    .from("loyalty_rewards")
    .select("id, name_ar, description_ar, points_cost, min_tier, max_per_customer, sort_order, created_at")
    .eq("restaurant_id", restaurant.id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  // Current user + customer for this tenant (if linked)
  const { data: { user } } = await sb.auth.getUser();
  let customer: CustomerView | null = null;
  if (user) {
    const { data: c } = await sb
      .from("customers")
      .select("id, loyalty_points_balance, loyalty_tier")
      .eq("auth_user_id", user.id)
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    if (c) {
      customer = {
        id: c.id as string,
        loyalty_points_balance: Number(c.loyalty_points_balance ?? 0),
        loyalty_tier: (c.loyalty_tier as CustomerView["loyalty_tier"]) ?? "bronze",
      };
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
            المكافآت · {restaurant.name}
          </h1>
        </div>
      </header>

      <main className="px-4 py-5">
        <RewardsClient
          slug={restaurant.slug}
          signedIn={!!user}
          customer={customer}
          rewards={(rewards ?? []) as Parameters<typeof RewardsClient>[0]["rewards"]}
        />
      </main>
    </div>
  );
}
