import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MenuLink",
  description: "Arabic-first menu and ordering platform for Saudi restaurants",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-brand-bg text-neutral-900 font-sans">{children}</body>
    </html>
  );
}
