import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MenuLink",
  description: "Arabic-first menu and ordering platform for Saudi restaurants",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {/* Stitch "Vibrant Poultry" typography stack + Arabic-first fallbacks
            Arabic display: Tajawal 700-900 (loud, condensed feel)
            Arabic body:    Cairo 400-700
            Latin display:  Anybody (Stitch original)
            Latin body:     Plus Jakarta Sans */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;800;900&family=Cairo:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Anybody:wght@700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-brand-bg text-neutral-900 font-sans">{children}</body>
    </html>
  );
}
