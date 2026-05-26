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
  url: string, opts: PosterOpts,
) {
  const { restaurantName, logoUrl, taglineAr, tableLabel } = opts;
  const emerald = "#0F2D26";
  const gold = "#C9A961";
  const cream = "#F4E8D4";
  const cardBg = "#FBF5E8";

  // Full emerald background
  ctx.fillStyle = emerald;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial gold glow — top-left
  const g1 = ctx.createRadialGradient(200, 300, 0, 200, 300, 600);
  g1.addColorStop(0, "rgba(201,169,97,0.08)");
  g1.addColorStop(1, "rgba(201,169,97,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial gold glow — bottom-right
  const g2 = ctx.createRadialGradient(880, 1300, 0, 880, 1300, 600);
  g2.addColorStop(0, "rgba(201,169,97,0.06)");
  g2.addColorStop(1, "rgba(201,169,97,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Top gold ornament line
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(W * 0.15, 120);
  ctx.lineTo(W * 0.85, 120);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Gold diamond center ornament
  const cx = W / 2;
  ctx.fillStyle = gold;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx, 112);
  ctx.lineTo(cx + 8, 120);
  ctx.lineTo(cx, 128);
  ctx.lineTo(cx - 8, 120);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  let cursorY = 170;

  // Logo (optional)
  if (logoUrl) {
    try {
      const img = await loadImage(logoUrl);
      const size = 140;
      const lx = (W - size) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx + size / 2, cursorY + size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.strokeStyle = gold;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.clip();
      ctx.drawImage(img, lx, cursorY, size, size);
      ctx.restore();
      cursorY += size + 36;
    } catch {
      cursorY += 20;
    }
  }

  // Restaurant name in cream
  ctx.fillStyle = cream;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.direction = "rtl";
  ctx.font = `700 72px "Reem Kufi", "Tajawal", system-ui, sans-serif`;
  ctx.fillText(restaurantName, W / 2, cursorY);
  cursorY += 96;

  // Tagline in gold
  if (taglineAr) {
    ctx.fillStyle = gold;
    ctx.font = `500 34px "Tajawal", system-ui, sans-serif`;
    ctx.fillText(taglineAr, W / 2, cursorY);
    cursorY += 56;
  }

  // Three gold dots ornament
  ctx.fillStyle = gold;
  ctx.globalAlpha = 0.5;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(W / 2 + i * 24, cursorY + 10, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  cursorY += 40;

  // QR code with heritage colors
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 640,
    color: { dark: emerald, light: cardBg },
  });

  const qrSize = 640;
  const qx = (W - qrSize) / 2;
  const qy = cursorY + 10;

  // Cream background for QR with gold border
  ctx.fillStyle = cardBg;
  roundRect(ctx, qx - 32, qy - 32, qrSize + 64, qrSize + 64, 20);
  ctx.fill();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  roundRect(ctx, qx - 32, qy - 32, qrSize + 64, qrSize + 64, 20);
  ctx.stroke();

  // Gold corner bracket accents
  const bLen = 60;
  const bOff = 20;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  // top-left
  ctx.beginPath();
  ctx.moveTo(qx - bOff, qy - bOff + bLen);
  ctx.lineTo(qx - bOff, qy - bOff);
  ctx.lineTo(qx - bOff + bLen, qy - bOff);
  ctx.stroke();
  // top-right
  ctx.beginPath();
  ctx.moveTo(qx + qrSize + bOff - bLen, qy - bOff);
  ctx.lineTo(qx + qrSize + bOff, qy - bOff);
  ctx.lineTo(qx + qrSize + bOff, qy - bOff + bLen);
  ctx.stroke();
  // bottom-left
  ctx.beginPath();
  ctx.moveTo(qx - bOff, qy + qrSize + bOff - bLen);
  ctx.lineTo(qx - bOff, qy + qrSize + bOff);
  ctx.lineTo(qx - bOff + bLen, qy + qrSize + bOff);
  ctx.stroke();
  // bottom-right
  ctx.beginPath();
  ctx.moveTo(qx + qrSize + bOff - bLen, qy + qrSize + bOff);
  ctx.lineTo(qx + qrSize + bOff, qy + qrSize + bOff);
  ctx.lineTo(qx + qrSize + bOff, qy + qrSize + bOff - bLen);
  ctx.stroke();

  ctx.drawImage(qrCanvas, qx, qy, qrSize, qrSize);
  cursorY = qy + qrSize + 80;

  // Table label (if table poster)
  if (tableLabel) {
    ctx.fillStyle = cream;
    ctx.font = `700 48px "Reem Kufi", "Tajawal", system-ui, sans-serif`;
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.fillText(`طاولة ${tableLabel}`, W / 2, cursorY);
    cursorY += 64;
  }

  // CTA in gold
  ctx.fillStyle = gold;
  ctx.font = `700 52px "Reem Kufi", "Tajawal", system-ui, sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillText("امسح لعرض القائمة", W / 2, cursorY);
  cursorY += 70;

  // URL in cream, small
  ctx.fillStyle = cream;
  ctx.globalAlpha = 0.5;
  ctx.direction = "ltr";
  ctx.font = `400 22px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, cursorY);
  ctx.globalAlpha = 1;
  cursorY += 50;

  // Bottom gold line
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(W * 0.2, H - 80);
  ctx.lineTo(W * 0.8, H - 80);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // "Powered by MenuLink" footer
  ctx.fillStyle = cream;
  ctx.globalAlpha = 0.4;
  ctx.direction = "ltr";
  ctx.font = `400 20px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText("Powered by MenuLink", W / 2, H - 50);
  ctx.globalAlpha = 1;
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
