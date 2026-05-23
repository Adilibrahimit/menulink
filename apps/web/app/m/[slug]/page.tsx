import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import MenuExperience from "./menu-experience";
import PwaBootstrap from "./pwa-bootstrap";
import type { PublicMenu } from "./types";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const sb = createClient();
  const { data } = await sb.rpc("get_public_menu", { p_slug: params.slug });
  const menu = data as PublicMenu | null;
  if (!menu) return { title: "MenuLink" };
  return {
    title: `${menu.restaurant.name} · قائمة الطعام`,
    description: menu.restaurant.tagline_ar ?? `اطلب من ${menu.restaurant.name} عبر واتساب`,
    themeColor: menu.restaurant.primary_color,
    manifest: `/m/${params.slug}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: menu.restaurant.name,
      statusBarStyle: "black-translucent",
    },
  };
}

export default async function CustomerMenuPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const sb = createClient();
  const { data, error } = await sb.rpc("get_public_menu", { p_slug: params.slug });
  if (error || !data) notFound();
  const menu = data as PublicMenu;

  // `?table=5` from the table-QR scan. Take the first value if an array
  // sneaks through (`?table=5&table=6` → "5"). Trim whitespace.
  const raw = searchParams.table;
  const rawTableLabel = (Array.isArray(raw) ? raw[0] : raw)?.trim() || null;

  // Soft-degrade: if the restaurant doesn't have the tables_qr addon enabled,
  // ignore the ?table= param. Old printed QRs keep scanning to a working
  // menu — they just no longer lock dine-in. This avoids stranding tenants
  // who deactivate the service but still have physical stickers out.
  const tableLabel = rawTableLabel && (await hasAddon(menu.restaurant.id, "tables_qr"))
    ? rawTableLabel
    : null;

  // Loyalty preview: when the loyalty addon is on for this tenant AND
  // loyalty_settings.enabled is true, the cart drawer renders an "earn X
  // points" preview once the customer types a phone. Lookup happens here
  // (server) so the client doesn't round-trip on every render.
  let loyaltyPointsPerSar: number | null = null;
  if (await hasAddon(menu.restaurant.id, "loyalty")) {
    const { data: ls } = await sb
      .from("loyalty_settings")
      .select("enabled, points_per_sar")
      .eq("restaurant_id", menu.restaurant.id)
      .maybeSingle();
    if (ls?.enabled) loyaltyPointsPerSar = Number(ls.points_per_sar);
  }

  const cssVars = {
    "--brand": menu.restaurant.primary_color,
    "--bg": menu.restaurant.background_color || "#fff8f6",
    "--ink": "#29170f",
    "--accent-gold": "#fdc415",
  } as React.CSSProperties;

  return (
    <div
      dir="rtl"
      style={cssVars}
      className="min-h-[100dvh]"
    >
      <MenuExperience
        menu={menu}
        tableLabel={tableLabel}
        loyaltyPointsPerSar={loyaltyPointsPerSar}
      />
      <PwaBootstrap />
    </div>
  );
}
