import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
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

export default async function CustomerMenuPage({ params }: { params: { slug: string } }) {
  const sb = createClient();
  const { data, error } = await sb.rpc("get_public_menu", { p_slug: params.slug });
  if (error || !data) notFound();
  const menu = data as PublicMenu;

  // Inject brand colors as CSS variables at the root of this page tree.
  // No JS needed for first paint — the server already knows the tenant.
  const cssVars = {
    "--brand": menu.restaurant.primary_color,
    "--bg": menu.restaurant.background_color,
  } as React.CSSProperties;

  return (
    <div
      dir="rtl"
      style={cssVars}
      className="min-h-[100dvh]"
    >
      <MenuExperience menu={menu} />
      <PwaBootstrap />
    </div>
  );
}
