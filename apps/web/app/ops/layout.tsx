import Link from "next/link";
import { headers } from "next/headers";
import { requireOps } from "@/lib/auth";
import { getLocale, getDictionary, dir } from "@/lib/i18n";
import LocaleToggle from "./locale-toggle";

const NAV_AR = [
  { href: "/ops",                label: "المطاعم",     icon: "🏪" },
  { href: "/ops/tenants/new",    label: "إضافة جديد",  icon: "➕" },
  { href: "/ops/payments",       label: "المدفوعات",   icon: "💳" },
  { href: "/ops/analytics",      label: "التحليلات",   icon: "📊" },
];

const NAV_EN = [
  { href: "/ops",                label: "Restaurants",   icon: "🏪" },
  { href: "/ops/tenants/new",    label: "Add New",       icon: "➕" },
  { href: "/ops/payments",       label: "Payments",      icon: "💳" },
  { href: "/ops/analytics",      label: "Analytics",     icon: "📊" },
];

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = headers().get("x-pathname") ?? "";
  if (path.startsWith("/ops/login")) return <>{children}</>;

  const me = await requireOps();
  const locale = getLocale();
  const d = getDictionary(locale);
  const NAV = locale === "ar" ? NAV_AR : NAV_EN;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100" dir={dir(locale)}>
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-neutral-100 font-bold">MenuLink</span>
            <span className="text-neutral-600">/</span>
            <span className="text-neutral-300 text-sm font-medium">Ops</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <LocaleToggle current={locale} />
            <span className="text-neutral-400 hidden sm:inline">{me.email}</span>
            <form action="/ops/logout" method="post">
              <button className="text-neutral-400 hover:text-neutral-100">
                {d.common.logout}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[200px,1fr] gap-6">
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`block rounded-md px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900 ${locale === "ar" ? "" : "text-left"}`}
            >
              <span className={locale === "ar" ? "ml-2" : "mr-2"}>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
