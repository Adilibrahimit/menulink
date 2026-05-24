import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { buildCssVars } from "@/lib/themes";
import AddressesClient from "./addresses-client";

export default async function AddressesPage({
  params,
}: {
  params: { slug: string };
}) {
  const sb = createClient();

  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id, slug, name, primary_color, background_color")
    .eq("slug", params.slug)
    .single();
  if (!restaurant) notFound();

  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/m/${params.slug}/account`);

  const { data: customer } = await sb
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  const { data: addresses } = customer
    ? await sb
        .from("customer_addresses")
        .select("id, label, address, lat, lng, details, is_default")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const cssVars = buildCssVars(params.slug, {
    primary_color: restaurant.primary_color || "#ac0015",
    background_color: restaurant.background_color || "#fff8f6",
  });

  return (
    <div dir="rtl" style={cssVars} className="min-h-[100dvh] bg-[var(--bg)]">
      <header className="bg-[var(--brand)] text-white px-5 py-4 flex items-center gap-3">
        <a href={`/m/${params.slug}/account`} className="text-2xl">←</a>
        <h1
          className="font-extrabold text-lg"
          style={{ fontFamily: "var(--font-display)" }}
        >
          عناويني
        </h1>
      </header>

      <main className="px-4 py-5">
        <AddressesClient
          slug={params.slug}
          customerId={customer?.id ?? null}
          restaurantId={restaurant.id}
          initial={(addresses ?? []).map((a) => ({
            id: a.id as string,
            label: a.label as "home" | "office" | "custom",
            address: a.address as string,
            lat: a.lat ? Number(a.lat) : null,
            lng: a.lng ? Number(a.lng) : null,
            details: (a.details as string | null) ?? null,
            is_default: a.is_default as boolean,
          }))}
        />
      </main>
    </div>
  );
}
