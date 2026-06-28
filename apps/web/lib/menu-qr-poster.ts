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
  posterStyle?: "default" | "heritage-emerald" | "wadi-dual";
  qrUrl?: string;
  // wadi-dual extras: a second QR (Google review) shown beside the menu QR,
  // plus contact lines for the printable lounge poster.
  reviewUrl?: string;
  addressAr?: string | null;
  phone?: string | null;
};

export async function generatePosterDataUrl(opts: PosterOpts): Promise<{ dataUrl: string; url: string }> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = opts.qrUrl
    ? opts.qrUrl
    : opts.tableLabel
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

  if (opts.posterStyle === "wadi-dual") {
    const menuUrl = `${origin}/m/${opts.slug}`;
    await drawWadiDualPoster(ctx, W, H, menuUrl, opts);
    return { dataUrl: canvas.toDataURL("image/png"), url: menuUrl };
  } else if (opts.posterStyle === "heritage-emerald") {
    await drawHeritagePoster(ctx, W, H, url, opts);
  } else {
    await drawDefaultPoster(ctx, W, H, url, opts);
  }

  return { dataUrl: canvas.toDataURL("image/png"), url };
}

// Wadi Almusafir lounge poster — dark + gold, two QRs side by side
// (المنيو + قيّمنا على Google), faithful to the client's own printed poster.
async function drawWadiDualPoster(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  menuUrl: string, opts: PosterOpts,
) {
  const GOLD = "#D9B65C";
  const GOLD_SOFT = "#E2C674";
  const DARK = "#0B0805";
  const INK = "#F3E9D6";

  // background + outer gold frame
  ctx.fillStyle = DARK;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  roundRect(ctx, 36, 36, W - 72, H - 72, 28);
  ctx.stroke();
  ctx.lineWidth = 1;
  roundRect(ctx, 50, 50, W - 100, H - 100, 22);
  ctx.strokeStyle = "rgba(217,182,92,0.4)";
  ctx.stroke();

  let y = 150;
  // logo or name
  if (opts.logoUrl) {
    try {
      const img = await loadImage(opts.logoUrl);
      const maxW = 360, maxH = 300;
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      const w = img.naturalWidth * ratio, h = img.naturalHeight * ratio;
      ctx.drawImage(img, (W - w) / 2, y, w, h);
      y += h + 30;
    } catch { /* fall through to text */ }
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.direction = "rtl";
  ctx.fillStyle = GOLD;
  ctx.font = `700 76px "Reem Kufi", "Tajawal", system-ui, sans-serif`;
  ctx.fillText(opts.restaurantName, W / 2, y);
  y += 96;
  if (opts.taglineAr) {
    ctx.fillStyle = INK;
    ctx.font = `400 34px "Tajawal", system-ui, sans-serif`;
    ctx.fillText(opts.taglineAr, W / 2, y);
    y += 64;
  }

  // session-duration pill
  const pillW = 460, pillH = 96, px = (W - pillW) / 2;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  roundRect(ctx, px, y, pillW, pillH, 48);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `500 36px "Tajawal", system-ui, sans-serif`;
  ctx.fillText("مدة الجلسة", W / 2 + 70, y + 28);
  ctx.fillStyle = GOLD;
  ctx.font = `700 44px "Reem Kufi", "Tajawal", system-ui, sans-serif`;
  ctx.fillText("ساعتين", W / 2 - 110, y + 24);
  y += pillH + 70;

  // two QR panels
  const qrBox = 380;
  const gap = 80;
  const totalW = qrBox * 2 + gap;
  const leftX = (W - totalW) / 2;
  const rightX = leftX + qrBox + gap;
  const labelY = y;
  const panelY = y + 64;

  // labels
  ctx.fillStyle = GOLD_SOFT;
  ctx.font = `700 42px "Reem Kufi", "Tajawal", system-ui, sans-serif`;
  ctx.fillText("المنيو", leftX + qrBox / 2, labelY);
  ctx.fillText("قيّمنا على Google", rightX + qrBox / 2, labelY);

  await drawQrPanel(ctx, leftX, panelY, qrBox, menuUrl);
  if (opts.reviewUrl) await drawQrPanel(ctx, rightX, panelY, qrBox, opts.reviewUrl);

  y = panelY + qrBox + 90;

  // footer lines
  ctx.fillStyle = INK;
  ctx.font = `500 34px "Tajawal", system-ui, sans-serif`;
  ctx.fillText("نسعد بزيارتكم ورأيكم يهمنا", W / 2, y);
  y += 62;
  ctx.fillStyle = GOLD;
  ctx.font = `400 30px "Tajawal", system-ui, sans-serif`;
  if (opts.phone) {
    ctx.direction = "ltr";
    ctx.fillText(opts.phone, W / 2, y);
    ctx.direction = "rtl";
    y += 48;
  }
  if (opts.addressAr) {
    ctx.fillStyle = INK;
    ctx.fillText("📍 " + opts.addressAr, W / 2, y);
  }
}

async function drawQrPanel(
  ctx: CanvasRenderingContext2D, x: number, yTop: number, box: number, url: string,
) {
  // cream rounded panel behind the QR (so dark-on-light scans well)
  ctx.fillStyle = "#F3E9D6";
  roundRect(ctx, x, yTop, box, box, 22);
  ctx.fill();
  ctx.strokeStyle = "#D9B65C";
  ctx.lineWidth = 2;
  roundRect(ctx, x, yTop, box, box, 22);
  ctx.stroke();

  const qrCanvas = document.createElement("canvas");
  const inner = box - 56;
  await QRCode.toCanvas(qrCanvas, url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: inner,
    color: { dark: "#0B0805", light: "#F3E9D6" },
  });
  ctx.drawImage(qrCanvas, x + 28, yTop + 28, inner, inner);
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
