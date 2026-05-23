"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { generatePosterDataUrl, triggerDownload } from "@/lib/menu-qr-poster";

type Props = {
  slug: string;
  restaurantName: string;
  logoUrl: string | null;
  taglineAr: string | null;
  primaryColor: string;
  tableLabel?: string | null;
};

export default function MenuQR({
  slug,
  restaurantName,
  logoUrl,
  taglineAr,
  primaryColor,
  tableLabel,
}: Props) {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  const menuUrl = origin
    ? tableLabel
      ? `${origin}/m/${slug}?table=${encodeURIComponent(tableLabel)}`
      : `${origin}/m/${slug}`
    : "";

  const fileBase = tableLabel ? `${slug}-table-${slugifyLabel(tableLabel)}` : `${slug}`;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!menuUrl || !previewRef.current) return;
    QRCode.toCanvas(previewRef.current, menuUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 280,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch((err) => console.error("QR preview render failed", err));
  }, [menuUrl]);

  async function downloadPNG() {
    if (!menuUrl) return;
    setBusy("png");
    try {
      const dataUrl = await QRCode.toDataURL(menuUrl, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 1024,
        color: { dark: "#000000", light: "#ffffff" },
      });
      triggerDownload(dataUrl, `${fileBase}-qr.png`);
    } finally {
      setBusy(null);
    }
  }

  async function downloadSVG() {
    if (!menuUrl) return;
    setBusy("svg");
    try {
      const svg = await QRCode.toString(menuUrl, {
        type: "svg",
        errorCorrectionLevel: "H",
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${fileBase}-qr.svg`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(null);
    }
  }

  async function downloadCard() {
    if (!menuUrl) return;
    setBusy("card");
    try {
      const { dataUrl } = await generatePosterDataUrl({
        slug,
        restaurantName,
        logoUrl,
        taglineAr,
        primaryColor,
        tableLabel: tableLabel ?? null,
      });
      triggerDownload(dataUrl, `${fileBase}-poster.png`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 flex flex-col items-center text-center">
        <h2
          className="text-lg font-extrabold mb-2 text-neutral-900"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          {tableLabel ? `رمز QR · طاولة ${tableLabel}` : "رمز QR للقائمة"}
        </h2>
        <p className="text-sm text-neutral-500 mb-4 max-w-md">
          {tableLabel
            ? `العميل يمسح هذا الرمز من الطاولة ${tableLabel} فيفتح القائمة مباشرة وطلبه يصلك مع رقم الطاولة.`
            : "اطبعه وضعه على الطاولات أو الواجهة. العميل يمسح، يفتح القائمة فوراً، ويثبّت التطبيق على جواله بنقرة واحدة."}
        </p>
        <canvas ref={previewRef} className="rounded-xl shadow-md" />
        {menuUrl && (
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 text-xs text-neutral-500 hover:text-neutral-900 break-all"
            dir="ltr"
          >
            {menuUrl}
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={downloadCard}
          disabled={!menuUrl || busy !== null}
          className="h-14 rounded-2xl bg-brand-primary text-white font-extrabold hover:opacity-90 disabled:opacity-60 active:translate-y-px shadow-md"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          {busy === "card" ? "..." : "🖼️ بطاقة للطباعة (PNG)"}
        </button>
        <button
          onClick={downloadPNG}
          disabled={!menuUrl || busy !== null}
          className="h-14 rounded-2xl bg-white border-2 border-neutral-200 text-neutral-800 font-extrabold hover:border-neutral-300 disabled:opacity-60 active:translate-y-px"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          {busy === "png" ? "..." : "⬇ QR فقط · PNG"}
        </button>
        <button
          onClick={downloadSVG}
          disabled={!menuUrl || busy !== null}
          className="h-14 rounded-2xl bg-white border-2 border-neutral-200 text-neutral-800 font-extrabold hover:border-neutral-300 disabled:opacity-60 active:translate-y-px"
          style={{ fontFamily: "Tajawal, system-ui, sans-serif" }}
        >
          {busy === "svg" ? "..." : "⬇ QR فقط · SVG"}
        </button>
      </div>
    </div>
  );
}

function slugifyLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9؀-ۿ]+/g, "-").replace(/^-+|-+$/g, "") || "table";
}
