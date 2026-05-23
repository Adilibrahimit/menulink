// Shared canvas-based "print-ready poster" generator used by:
//   - /admin/qr (menu-wide QR)
//   - /admin/tables (per-table QR with "طاولة X" footer)
//   - /ops/tenants/[id] (same as /admin/qr but ops-facing)
//
// Returns a PNG data URL. Caller is responsible for triggering the download.

import QRCode from "qrcode";

export type PosterOpts = {
  slug: string;
  restaurantName: string;
  logoUrl: string | null;
  taglineAr: string | null;
  primaryColor: string;
  tableLabel?: string | null;
};

export async function generatePosterDataUrl(opts: PosterOpts): Promise<{ dataUrl: string; url: string }> {
  const { slug, restaurantName, logoUrl, taglineAr, primaryColor, tableLabel } = opts;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = tableLabel
    ? `${origin}/m/${slug}?table=${encodeURIComponent(tableLabel)}`
    : `${origin}/m/${slug}`;

  // Wait for webfonts so the Arabic name renders in Tajawal, not canvas default.
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

  // Brand band
  const band = 240;
  ctx.fillStyle = primaryColor || "#ac0015";
  ctx.fillRect(0, 0, W, band);

  // Logo (optional, sits half on band)
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

  // QR
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
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

  // CTA — different for table posters
  ctx.fillStyle = primaryColor || "#ac0015";
  ctx.font = `800 56px "Tajawal", "Segoe UI", system-ui, sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  if (tableLabel) {
    ctx.fillText(`🪑 طاولة ${tableLabel}`, W / 2, cursorY);
  } else {
    ctx.fillText("امسح للطلب", W / 2, cursorY);
  }
  cursorY += 70;

  // URL footer
  ctx.fillStyle = "#888888";
  ctx.direction = "ltr";
  ctx.font = `500 24px "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, cursorY);

  return { dataUrl: canvas.toDataURL("image/png"), url };
}

export function triggerDownload(href: string, filename: string) {
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
