import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { getCurrentUser, requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { getEnabledAddons, type AddonKey } from "@/lib/addons";
import type { Restaurant } from "@/lib/types";
import SubscriptionBanner from "./subscription-banner";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  addon: AddonKey | null;   // null = always visible (base feature)
};

const NAV: NavItem[] = [
  { href: "/admin",           label: "اللوحة",   icon: "🏠", addon: null },
  { href: "/admin/orders",    label: "الطلبات",  icon: "🛒", addon: null },
  { href: "/admin/menu",      label: "القائمة",  icon: "🍽️", addon: null },
  { href: "/admin/customers", label: "العملاء",  icon: "👤", addon: null },
  { href: "/admin/qr",        label: "رمز QR",   icon: "🔳", addon: null },
  { href: "/admin/branches",  label: "الفروع",   icon: "🏢", addon: "multi_branch" },
  { href: "/admin/drivers",   label: "السائقين", icon: "🛵", addon: "drivers" },
  { href: "/admin/zones",     label: "نطاق التوصيل", icon: "📍", addon: "delivery_zones" },
  { href: "/admin/tables",    label: "الطاولات", icon: "🪑", addon: "tables_qr" },
  { href: "/admin/reports",   label: "التقارير", icon: "📊", addon: "advanced_reports" },
  { href: "/admin/loyalty",   label: "الولاء",   icon: "🏆", addon: "loyalty" },
  { href: "/admin/broadcast", label: "الإشعارات", icon: "🔔", addon: "push_marketing" },
  { href: "/admin/info",      label: "المعلومات", icon: "⚙️", addon: null },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Login page is also under /admin but should NOT be wrapped in the shell.
  const path = headers().get("x-pathname") ?? "";
  const isLogin = path.startsWith("/admin/login");

  if (isLogin) return <>{children}</>;

  // Anyone reaching /admin/* (besides /login) must be an owner.
  const me = await requireOwner();

  // Pull the restaurant the owner manages
  const sb = createClient();
  const [{ data: restaurant }, enabledAddons] = await Promise.all([
    sb.from("restaurants").select("*").eq("id", me.restaurant_id).single(),
    getEnabledAddons(me.restaurant_id),
  ]);

  const visibleNav = NAV.filter((n) => !n.addon || enabledAddons.has(n.addon));

  return (
    <div className="min-h-screen bg-brand-bg" dir="rtl">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/menulink-logo.png" alt="MenuLink" width={48} height={48} className="rounded-lg" />
            <span className="text-brand-primary font-bold">MenuLink</span>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-700 text-sm font-medium">
              {(restaurant as Restaurant | null)?.name ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-neutral-500 hidden sm:inline">{me.email}</span>
            <form action="/admin/logout" method="post">
              <button className="text-neutral-600 hover:text-brand-primary">
                خروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[200px,1fr] gap-6">
        <nav className="space-y-1">
          {visibleNav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-white text-neutral-700"
            >
              <span className="ml-2">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <main>
          <SubscriptionBanner restaurantId={me.restaurant_id} />
          {children}
        </main>
      </div>
    </div>
  );
}
