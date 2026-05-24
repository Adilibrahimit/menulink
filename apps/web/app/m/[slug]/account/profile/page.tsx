import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import ProfileClient from "./profile-client";

export default async function CustomerProfilePage({
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
    .select("id, name, phone, email, birthday")
    .eq("auth_user_id", user.id)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();
  if (!customer) redirect(`/m/${params.slug}/account`);

  const cssVars = {
    "--brand": restaurant.primary_color || "#ac0015",
    "--bg": restaurant.background_color || "#fff8f6",
  } as React.CSSProperties;

  return (
    <div dir="rtl" style={cssVars} className="min-h-[100dvh] bg-[var(--bg)]">
      <header className="bg-[var(--brand)] text-white px-5 py-4 flex items-center gap-3">
        <a href={`/m/${restaurant.slug}/account`} className="text-2xl">←</a>
        <h1
          className="font-extrabold text-lg leading-tight"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          معلوماتي
        </h1>
      </header>

      <ProfileClient
        slug={restaurant.slug}
        restaurantId={restaurant.id}
        customerId={customer.id as string}
        initialName={(customer.name as string | null) ?? ""}
        initialPhone={(customer.phone as string) ?? ""}
        initialEmail={(customer.email as string | null) ?? user.email ?? ""}
        initialBirthday={(customer.birthday as string | null) ?? ""}
      />
    </div>
  );
}
