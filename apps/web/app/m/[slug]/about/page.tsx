import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { buildCssVars } from "@/lib/themes";

export default async function AboutPage({
  params,
}: {
  params: { slug: string };
}) {
  const sb = createClient();
  const { data: restaurant } = await sb
    .from("restaurants")
    .select("id, slug, name, primary_color, background_color, logo_url, about_ar, vision_ar, mission_ar")
    .eq("slug", params.slug)
    .single();
  if (!restaurant) notFound();

  const cssVars = buildCssVars(params.slug, {
    primary_color: restaurant.primary_color || "#ac0015",
    background_color: restaurant.background_color || "#fff8f6",
  });

  const hasContent = restaurant.about_ar || restaurant.vision_ar || restaurant.mission_ar;

  return (
    <div dir="rtl" style={cssVars} className="min-h-[100dvh] bg-[var(--bg)]">
      <header className="bg-[var(--brand)] text-white px-5 py-4 flex items-center gap-3">
        <a href={`/m/${restaurant.slug}/account`} className="text-2xl">←</a>
        <h1
          className="font-extrabold text-lg leading-tight"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          معلومات عنا
        </h1>
      </header>

      <main className="px-4 py-5 space-y-4">
        {/* Logo + name */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center">
          {restaurant.logo_url && (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-20 h-20 rounded-2xl object-cover mx-auto mb-3"
            />
          )}
          <h2
            className="text-xl font-extrabold text-neutral-900"
            style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
          >
            {restaurant.name}
          </h2>
        </div>

        {!hasContent ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-2">ℹ️</div>
            <p className="text-sm text-neutral-500" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
              لم يتم إضافة معلومات بعد
            </p>
          </div>
        ) : (
          <>
            {restaurant.about_ar && (
              <Section title="من نحن" emoji="🏪">
                {restaurant.about_ar}
              </Section>
            )}
            {restaurant.vision_ar && (
              <Section title="رؤيتنا" emoji="🔭">
                {restaurant.vision_ar}
              </Section>
            )}
            {restaurant.mission_ar && (
              <Section title="رسالتنا" emoji="🎯">
                {restaurant.mission_ar}
              </Section>
            )}
          </>
        )}

        <a
          href={`/m/${restaurant.slug}`}
          className="block w-full h-12 rounded-2xl bg-[var(--brand)] text-white text-center text-base font-extrabold leading-[3rem] active:translate-y-px shadow-md"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          تصفح القائمة
        </a>
      </main>
    </div>
  );
}

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4">
      <h3 className="font-extrabold text-neutral-900 mb-2 flex items-center gap-2" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
        <span>{emoji}</span> {title}
      </h3>
      <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line" style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}>
        {children}
      </p>
    </div>
  );
}
