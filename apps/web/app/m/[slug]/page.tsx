import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { hasAddon } from "@/lib/addons";
import { getTheme, buildCssVars } from "@/lib/themes";
import MenuExperience from "./menu-experience";
import DisplayOnlyMenu from "./display-only-menu";
import PwaBootstrap from "./pwa-bootstrap";
import CustomerShell from "./customer-shell";
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
  const pushEnabled = await hasAddon(menu.restaurant.id, "push_marketing");
  const notifCenterEnabled = await hasAddon(menu.restaurant.id, "notification_center");

  const { data: branchRows } = await sb
    .from("restaurant_branches")
    .select("id, name_ar, name_en, slug, whatsapp, address_ar, lat, lng, supports_delivery, supports_pickup, supports_dine_in, supports_car, is_default")
    .eq("restaurant_id", menu.restaurant.id)
    .eq("is_active", true)
    .order("sort_order");
  const branches = branchRows ?? [];

  let loyaltyPointsPerSar: number | null = null;
  let redemptionValueSar = 0;
  if (await hasAddon(menu.restaurant.id, "loyalty")) {
    const { data: ls } = await sb
      .from("loyalty_settings")
      .select("enabled, points_per_sar, redemption_value_sar")
      .eq("restaurant_id", menu.restaurant.id)
      .maybeSingle();
    if (ls?.enabled) loyaltyPointsPerSar = Number(ls.points_per_sar);
    if (ls?.enabled) redemptionValueSar = Number(ls.redemption_value_sar) || 0;
  }

  const theme = getTheme(params.slug);
  const cssVars = buildCssVars(params.slug, {
    primary_color: menu.restaurant.primary_color,
    background_color: menu.restaurant.background_color,
  });

  if (menu.restaurant.display_only_mode) {
    return (
      <div dir="rtl" style={cssVars} className="min-h-[100dvh]">
        {theme.fonts.googleUrl && (
          // eslint-disable-next-line @next/next/no-page-custom-font
          <link rel="stylesheet" href={theme.fonts.googleUrl} />
        )}
        <DisplayOnlyMenu menu={menu} theme={theme} />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={cssVars}
      className="min-h-[100dvh]"
    >
      {theme.fonts.googleUrl && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={theme.fonts.googleUrl} />
      )}
      <CustomerShell menu={menu} tableParam={tableLabel} theme={theme} notifCenterEnabled={notifCenterEnabled}>
        <MenuExperience
          menu={menu}
          tableLabel={tableLabel}
          loyaltyPointsPerSar={loyaltyPointsPerSar}
          redemptionValueSar={redemptionValueSar}
          theme={theme}
          pushEnabled={pushEnabled}
          vapidKey={process.env.NEXT_PUBLIC_VAPID_KEY ?? ""}
          branches={branches}
        />
        <PwaBootstrap />
      </CustomerShell>
    </div>
  );
}
