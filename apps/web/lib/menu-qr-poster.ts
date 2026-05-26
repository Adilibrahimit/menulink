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
  const gold = "#C9A961";
  const darkGreen = "#1B6B4A";
  const ink = "#1a1a1a";

  // White background
  ctx.fillStyle = "#FAFAF8";
  ctx.fillRect(0, 0, W, H);

  // --- Palm leaf (green, top center) ---
  ctx.save();
  ctx.translate(W / 2 - 10, 80);
  ctx.scale(1.6, 1.6);
  drawPalmLeaf(ctx, darkGreen);
  ctx.restore();

  // --- "al musafer" in script font ---
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.direction = "ltr";
  ctx.font = `italic 400 96px "Dancing Script", "Great Vibes", "Segoe Script", cursive`;
  ctx.fillText("al musafer", W / 2, 240);

  // --- Gold ornamental frame around QR ---
  const frameX = 100;
  const frameY = 420;
  const frameW = W - 200;
  const frameH = 780;
  drawOrnamentalFrame(ctx, frameX, frameY, frameW, frameH, gold);

  // --- QR code inside the frame ---
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 640,
    color: { dark: "#000000", light: "#FAFAF8" },
  });
  const qrSize = 640;
  const qx = (W - qrSize) / 2;
  const qy = frameY + (frameH - qrSize) / 2;
  ctx.drawImage(qrCanvas, qx, qy, qrSize, qrSize);

  // --- Gold divider line with diamond below frame ---
  const divY = frameY + frameH + 80;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W * 0.3, divY);
  ctx.lineTo(W / 2 - 14, divY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W / 2 + 14, divY);
  ctx.lineTo(W * 0.7, divY);
  ctx.stroke();

  // Diamond
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.moveTo(W / 2, divY - 7);
  ctx.lineTo(W / 2 + 7, divY);
  ctx.lineTo(W / 2, divY + 7);
  ctx.lineTo(W / 2 - 7, divY);
  ctx.closePath();
  ctx.fill();

  // --- "Powered by MenuLink" footer ---
  ctx.fillStyle = "#888888";
  ctx.direction = "ltr";
  ctx.textAlign = "center";
  ctx.font = `400 28px "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif`;
  ctx.fillText("Powered by MenuLink", W / 2, divY + 50);
}

function drawPalmLeaf(ctx: CanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  // Main stem
  ctx.beginPath();
  ctx.moveTo(30, 80);
  ctx.quadraticCurveTo(32, 40, 35, 0);
  ctx.stroke();

  // Leaflets — pairs fanning out from the stem
  const leaves: [number, number, number, number, number, number][] = [
    [34, 8, 10, -20, -15, -10],
    [34, 15, 5, -30, -25, -5],
    [33, 25, 0, -38, -30, 5],
    [33, 35, -2, -42, -32, 10],
    [32, 45, 0, -40, -28, 15],
    [32, 55, 5, -35, -22, 22],
    [31, 65, 10, -25, -15, 28],
    [35, 8, 60, -20, 65, -10],
    [35, 15, 65, -30, 75, -5],
    [35, 25, 68, -38, 80, 5],
    [35, 35, 70, -42, 82, 10],
    [36, 45, 68, -40, 78, 15],
    [36, 55, 65, -35, 72, 22],
    [36, 65, 58, -25, 62, 28],
  ];
  for (const [sx, sy, cx, cy, ex, ey] of leaves) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.quadraticCurveTo(cx + 2, cy + 5, sx, sy + 3);
    ctx.fill();
  }
}

function drawOrnamentalFrame(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
) {
  const r = 24;
  const notch = 20;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  // Top-left corner
  ctx.moveTo(x + r, y);
  // Top edge with center notch curve
  ctx.lineTo(x + w / 2 - notch, y);
  ctx.quadraticCurveTo(x + w / 2, y - notch / 2, x + w / 2 + notch, y);
  // Top-right corner
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  // Right edge
  ctx.lineTo(x + w, y + h - r);
  // Bottom-right corner
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  // Bottom edge with center notch
  ctx.lineTo(x + w / 2 + notch, y + h);
  ctx.quadraticCurveTo(x + w / 2, y + h + notch / 2, x + w / 2 - notch, y + h);
  // Bottom-left corner
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  // Left edge
  ctx.lineTo(x, y + r);
  // Top-left corner close
  ctx.quadraticCurveTo(x, y, x + r, y);

  ctx.closePath();
  ctx.stroke();
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
