import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { buildCssVars, getTheme } from "@/lib/themes";
import NotificationsClient from "./notifications-client";

export default async function CustomerNotificationsPage({
  params,
}: {
  params: { slug: string };
}) {
  const sb = createClient();

  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id, slug, name, primary_color, background_color, logo_url")
    .eq("slug", params.slug)
    .single();
  if (!restaurant) notFound();

  const { data: notifications } = await sb
    .from("tenant_notifications")
    .select("id, title, body, image_url, url, created_at")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const cssVars = buildCssVars(params.slug, {
    primary_color: restaurant.primary_color || "#ac0015",
    background_color: restaurant.background_color || "#fff8f6",
  });

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
          الإشعارات
        </h1>
      </header>

      <NotificationsClient
        slug={restaurant.slug}
        restaurantName={restaurant.name}
        logoUrl={restaurant.logo_url}
        notifications={(notifications ?? []).map((n) => ({
          id: n.id as string,
          title: n.title as string,
          body: (n.body as string | null) ?? null,
          image_url: (n.image_url as string | null) ?? null,
          url: (n.url as string | null) ?? null,
          created_at: n.created_at as string,
        }))}
      />
    </div>
  );
}
