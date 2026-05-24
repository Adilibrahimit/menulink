import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { buildCssVars } from "@/lib/themes";

export default async function ContactPage({
  params,
}: {
  params: { slug: string };
}) {
  const sb = createClient();
  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id, slug, name, primary_color, background_color, whatsapp_phone, contact_email, instagram_handle, tiktok_handle")
    .eq("slug", params.slug)
    .single();
  if (!restaurant) notFound();

  const cssVars = buildCssVars(params.slug, {
    primary_color: restaurant.primary_color || "#ac0015",
    background_color: restaurant.background_color || "#fff8f6",
  });

  const waPhone = (restaurant.whatsapp_phone || "").replace(/\D/g, "");
  const waLink = `https://wa.me/${waPhone}`;
  const complaintLink = `https://wa.me/${waPhone}?text=${encodeURIComponent("مرحبا، أرغب بتقديم شكوى بخصوص:")}`;

  return (
    <div dir="rtl" style={cssVars} className="min-h-[100dvh] bg-[var(--bg)]">
      <header className="bg-[var(--brand)] text-white px-5 py-4 flex items-center gap-3">
        <a href={`/m/${restaurant.slug}/account`} className="text-2xl">←</a>
        <h1
          className="font-extrabold text-lg leading-tight"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          اتصل بنا
        </h1>
      </header>

      <main className="px-4 py-5 space-y-3">
        {/* WhatsApp */}
        {waPhone && (
          <ContactCard
            href={waLink}
            icon="💬"
            title="واتساب"
            subtitle={`+${waPhone}`}
          />
        )}

        {/* Email */}
        {restaurant.contact_email && (
          <ContactCard
            href={`mailto:${restaurant.contact_email}`}
            icon="📧"
            title="البريد الإلكتروني"
            subtitle={restaurant.contact_email}
          />
        )}

        {/* Instagram */}
        {restaurant.instagram_handle && (
          <ContactCard
            href={`https://instagram.com/${restaurant.instagram_handle}`}
            icon="📸"
            title="انستقرام"
            subtitle={`@${restaurant.instagram_handle}`}
          />
        )}

        {/* TikTok */}
        {restaurant.tiktok_handle && (
          <ContactCard
            href={`https://tiktok.com/@${restaurant.tiktok_handle}`}
            icon="🎵"
            title="تيك توك"
            subtitle={`@${restaurant.tiktok_handle}`}
          />
        )}

        {/* Complaints */}
        {waPhone && (
          <div className="pt-4 border-t border-neutral-200">
            <a
              href={complaintLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white border-2 border-amber-200 rounded-2xl px-4 py-3 hover:border-amber-300 active:translate-y-px"
            >
              <span className="text-2xl shrink-0">📝</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
                  تقديم شكوى
                </div>
                <div className="text-[11px] text-neutral-500">سيتم التواصل معك عبر واتساب</div>
              </div>
              <span className="text-neutral-400 shrink-0">←</span>
            </a>
          </div>
        )}

        <a
          href={`/m/${restaurant.slug}`}
          className="block w-full h-12 rounded-2xl bg-[var(--brand)] text-white text-center text-base font-extrabold leading-[3rem] active:translate-y-px shadow-md mt-4"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          تصفح القائمة
        </a>
      </main>
    </div>
  );
}

function ContactCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-white border border-neutral-200 rounded-2xl px-4 py-3 hover:border-neutral-300 active:translate-y-px"
    >
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-neutral-900" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
          {title}
        </div>
        <div className="text-[11px] text-neutral-500" dir="ltr">{subtitle}</div>
      </div>
      <span className="text-neutral-400 shrink-0">←</span>
    </a>
  );
}
