"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Props = {
  slug: string;
  restaurantName: string;
  logoUrl: string | null;
  taglineAr: string | null;
  primaryColor: string;
};

export default function MenuQR({
  slug,
  restaurantName,
  logoUrl,
  taglineAr,
  primaryColor,
}: Props) {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  const menuUrl = origin ? `${origin}/m/${slug}` : "";

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
      triggerDownload(dataUrl, `${slug}-qr.png`);
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
      triggerDownload(url, `${slug}-qr.svg`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(null);
    }
  }

  async function downloadCard() {
    if (!menuUrl) return;
    setBusy("card");
    try {
      // Wait for webfonts so the Arabic restaurant name renders in Tajawal,
      // not the canvas default sans.
      try {
        await (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
      } catch {}

      const W = 1080;
      const H = 1620;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d ctx");

      // White paper
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Brand band at the top
      const band = 240;
      ctx.fillStyle = primaryColor || "#ac0015";
      ctx.fillRect(0, 0, W, band);

      // Logo (optional). Sits half on the band, half on the paper.
      let cursorY = band + 60;
      if (logoUrl) {
        try {
          const img = await loadImage(logoUrl);
          const size = 160;
          const lx = (W - size) / 2;
          const ly = band - size / 2;
          ctx.fillStyle = "#ffffff";
          roundRect(ctx, lx - 12, ly - 12, size + 24, size + 24, 28);
          ctx.fill();
          ctx.save();
          roundRect(ctx, lx, ly, size, size, 22);
          ctx.clip();
          ctx.drawImage(img, lx, ly, size, size);
          ctx.restore();
          cursorY = ly + size + 48;
        } catch (err) {
          console.warn("logo load failed, skipping", err);
        }
      }

      // Restaurant name
      ctx.fillStyle = "#111111";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.direction = "rtl";
      ctx.font = `800 64px "Tajawal", "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(restaurantName, W / 2, cursorY);
      cursorY += 80;

      if (taglineAr) {
        ctx.fillStyle = "#555555";
        ctx.font = `500 32px "Cairo", "Segoe UI", system-ui, sans-serif`;
        ctx.fillText(taglineAr, W / 2, cursorY);
        cursorY += 60;
      }

      // QR — render to a temp canvas, then composite with shadow
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, menuUrl, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 720,
        color: { dark: "#000000", light: "#ffffff" },
      });

      const qrSize = 720;
      const qx = (W - qrSize) / 2;
      const qy = cursorY + 20;
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 32;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, qx - 24, qy - 24, qrSize + 48, qrSize + 48, 28);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.drawImage(qrCanvas, qx, qy, qrSize, qrSize);
      cursorY = qy + qrSize + 80;

      // CTA
      ctx.fillStyle = primaryColor || "#ac0015";
      ctx.font = `800 56px "Tajawal", "Segoe UI", system-ui, sans-serif`;
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.fillText("امسح للطلب", W / 2, cursorY);
      cursorY += 70;

      // URL footer
      ctx.fillStyle = "#888888";
      ctx.direction = "ltr";
      ctx.font = `500 24px "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(menuUrl.replace(/^https?:\/\//, ""), W / 2, cursorY);

      const dataUrl = canvas.toDataURL("image/png");
      triggerDownload(dataUrl, `${slug}-poster.png`);
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
          رمز QR للقائمة
        </h2>
        <p className="text-sm text-neutral-500 mb-4 max-w-md">
          اطبعه وضعه على الطاولات أو الواجهة. العميل يمسح، يفتح القائمة فوراً،
          ويثبّت التطبيق على جواله بنقرة واحدة.
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

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
