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
  posterStyle?: "default" | "heritage-emerald";
};

export async function generatePosterDataUrl(opts: PosterOpts): Promise<{ dataUrl: string; url: string }> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = opts.tableLabel
    ? `${origin}/m/${opts.slug}?table=${encodeURIComponent(opts.tableLabel)}`
    : `${origin}/m/${opts.slug}`;

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

  if (opts.posterStyle === "heritage-emerald") {
    await drawHeritagePoster(ctx, W, H, url, opts);
  } else {
    await drawDefaultPoster(ctx, W, H, url, opts);
  }

  return { dataUrl: canvas.toDataURL("image/png"), url };
}

async function drawDefaultPoster(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  url: string, opts: PosterOpts,
) {
  const { restaurantName, logoUrl, taglineAr, primaryColor, tableLabel } = opts;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const band = 240;
  ctx.fillStyle = primaryColor || "#ac0015";
  ctx.fillRect(0, 0, W, band);

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

  ctx.fillStyle = "#888888";
  ctx.direction = "ltr";
  ctx.font = `500 24px "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, cursorY);
}

async function drawHeritagePoster(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  url: string, _opts: PosterOpts,
) {
  const templateUrl = "/qr-templates/mazaj-almosafer.png";
  const templateImg = await loadImage(templateUrl);

  const tW = templateImg.naturalWidth;
  const tH = templateImg.naturalHeight;
  ctx.drawImage(templateImg, 0, 0, W, H);

  const scaleX = W / tW;
  const scaleY = H / tH;

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 700,
    color: { dark: "#000000", light: "#FAFAF8" },
  });

  const frameLeft = 141;
  const frameTop = 482;
  const frameRight = 914;
  const frameBottom = 1232;
  const qrAreaW = frameRight - frameLeft;
  const qrAreaH = frameBottom - frameTop;
  const qrSize = Math.min(qrAreaW, qrAreaH);
  const qrX = frameLeft + (qrAreaW - qrSize) / 2;
  const qrY = frameTop + (qrAreaH - qrSize) / 2;

  ctx.drawImage(qrCanvas, qrX * scaleX, qrY * scaleY, qrSize * scaleX, qrSize * scaleY);
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
