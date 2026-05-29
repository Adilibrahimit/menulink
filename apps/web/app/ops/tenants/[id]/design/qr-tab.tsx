"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { generatePosterDataUrl, triggerDownload } from "@/lib/menu-qr-poster";
import { createQrCode } from "./qr-actions";
import { recordQrExport } from "./export-actions";

type Template = { id: string; key: string; name_ar: string };
type QrLinkRow = { id: string; code: string; target_type: string; is_active: boolean };
type QrExportRow = {
  id: string; qr_link_id: string; file_url: string | null;
  data_hash: string | null; status: string; rendered_at: string | null;
};
type QrProfileRow = { id: string; name_ar: string; purpose: string; links: QrLinkRow[] };
type Restaurant = {
  id: string; slug: string; name: string;
  logo_url: string | null; tagline_ar: string | null; primary_color: string;
};

const PURPOSES = ["menu", "table", "offer", "category", "item"] as const;
const PURPOSE_AR: Record<string, string> = {
  menu: "القائمة", table: "طاولة", offer: "عرض", category: "قسم", item: "صنف",
};

export default function QrTab({
  restaurant, templates, qrProfiles, qrExports, fingerprint,
}: {
  restaurant: Restaurant; templates: Template[]; qrProfiles: QrProfileRow[];
  qrExports: QrExportRow[]; fingerprint: string;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [nameAr, setNameAr] = useState("");
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>("menu");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function create() {
    if (!templateId) { setMsg({ kind: "err", text: "اختر قالباً" }); return; }
    setBusy(true); setMsg(null);
    const res = await createQrCode({ restaurantId: restaurant.id, slug: restaurant.slug, templateId, nameAr, purpose, target });
    setBusy(false);
    if (res.error) { setMsg({ kind: "err", text: res.error }); return; }
    setMsg({ kind: "ok", text: `تم إنشاء رمز QR (${res.code}) ✓` });
    setNameAr(""); setTarget("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className={`rounded-md text-sm p-3 ${msg.kind === "ok"
          ? "bg-green-900/40 border border-green-800 text-green-300"
          : "bg-red-900/40 border border-red-800 text-red-300"}`}>{msg.text}</p>
      )}

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-sm">إنشاء رمز QR ديناميكي</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-neutral-400 mb-1">قالب التصميم</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400">
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name_ar}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-400 mb-1">الاسم</span>
            <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="مثال: بوستر المدخل"
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400" />
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-400 mb-1">الوجهة</span>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)}
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400">
              {PURPOSES.map((p) => <option key={p} value={p}>{PURPOSE_AR[p]}</option>)}
            </select>
          </label>
          {purpose !== "menu" && (
            <label className="block">
              <span className="block text-xs text-neutral-400 mb-1">{purpose === "table" ? "رقم الطاولة" : "المعرّف (id)"}</span>
              <input value={target} onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-md bg-neutral-800 border border-neutral-700 text-neutral-100 px-3 py-2 outline-none focus:border-neutral-400" />
            </label>
          )}
        </div>
        <button onClick={create} disabled={busy}
          className="rounded-md bg-neutral-100 text-neutral-900 px-4 py-2 text-sm font-semibold hover:bg-white disabled:opacity-60">
          {busy ? "..." : "إنشاء"}
        </button>
        <p className="text-[10px] text-neutral-500">الرمز يشير إلى رابط ديناميكي /q/code يمكن إعادة توجيهه لاحقاً دون إعادة الطباعة.</p>
      </div>

      <div className="space-y-3">
        {qrProfiles.length === 0 && <p className="text-sm text-neutral-500">لا توجد رموز QR بعد.</p>}
        {qrProfiles.flatMap((p) => p.links.map((l) => (
          <QrLinkCard
            key={l.id}
            restaurant={restaurant}
            profileName={p.name_ar}
            link={l}
            qrExports={qrExports.filter((e) => e.qr_link_id === l.id)}
            fingerprint={fingerprint}
          />
        )))}
      </div>
    </div>
  );
}

function QrLinkCard({
  restaurant, profileName, link, qrExports, fingerprint,
}: {
  restaurant: Restaurant; profileName: string; link: QrLinkRow;
  qrExports: QrExportRow[]; fingerprint: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = origin ? `${origin}/q/${link.code}` : "";

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      errorCorrectionLevel: "H", margin: 2, width: 180, color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [url]);

  async function dl(kind: "png" | "svg" | "poster") {
    if (!url) return;
    setBusy(kind);
    try {
      if (kind === "png") {
        const d = await QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 2, width: 1024 });
        triggerDownload(d, `${restaurant.slug}-${link.code}-qr.png`);
      } else if (kind === "svg") {
        const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H", margin: 2 });
        const u = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        triggerDownload(u, `${restaurant.slug}-${link.code}-qr.svg`);
        setTimeout(() => URL.revokeObjectURL(u), 1000);
      } else {
        const { dataUrl } = await generatePosterDataUrl({
          slug: restaurant.slug, restaurantName: restaurant.name, logoUrl: restaurant.logo_url,
          taglineAr: restaurant.tagline_ar, primaryColor: restaurant.primary_color,
          tableLabel: null, posterStyle: "default", qrUrl: url,
        });
        triggerDownload(dataUrl, `${restaurant.slug}-${link.code}-poster.png`);
      }
    } finally { setBusy(null); }
  }

  async function saveExport() {
    if (!url) return;
    setBusy("save");
    try {
      const d = await QRCode.toDataURL(url, { errorCorrectionLevel: "H", margin: 2, width: 1024 });
      const res = await recordQrExport({
        restaurantId: restaurant.id, slug: restaurant.slug, qrLinkId: link.id, pngDataUrl: d,
      });
      if (!res.error) router.refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center">
      <canvas ref={canvasRef} className="rounded-lg bg-white p-1 shrink-0" />
      <div className="flex-1 min-w-0 text-center sm:text-right">
        <div className="text-sm text-neutral-100">{profileName} · {PURPOSE_AR[link.target_type] ?? link.target_type}</div>
        <div className="text-xs text-neutral-500 font-mono break-all" dir="ltr">/q/{link.code}{link.is_active ? "" : " (معطّل)"}</div>
        <div className="mt-2 flex gap-2 flex-wrap justify-center sm:justify-start">
          <button onClick={() => dl("poster")} disabled={busy !== null}
            className="text-xs rounded bg-neutral-100 text-neutral-900 px-2 py-1 font-semibold hover:bg-white disabled:opacity-60">{busy === "poster" ? "..." : "بوستر PNG"}</button>
          <button onClick={() => dl("png")} disabled={busy !== null}
            className="text-xs rounded bg-neutral-800 border border-neutral-700 px-2 py-1 hover:bg-neutral-700 disabled:opacity-60">QR PNG</button>
          <button onClick={() => dl("svg")} disabled={busy !== null}
            className="text-xs rounded bg-neutral-800 border border-neutral-700 px-2 py-1 hover:bg-neutral-700 disabled:opacity-60">QR SVG</button>
          <button onClick={saveExport} disabled={busy !== null}
            className="text-xs rounded bg-neutral-800 border border-neutral-700 px-2 py-1 hover:bg-neutral-700 disabled:opacity-60">{busy === "save" ? "..." : "💾 حفظ نسخة"}</button>
        </div>
        {qrExports.length > 0 && (
          <div className="mt-3 space-y-1 text-[11px]">
            {qrExports.map((e) => {
              const outdated = !!fingerprint && e.data_hash !== fingerprint;
              return (
                <div key={e.id} className="flex items-center gap-2 justify-center sm:justify-start text-neutral-400">
                  {e.file_url
                    ? <a href={e.file_url} target="_blank" rel="noreferrer" className="underline hover:text-neutral-200">تحميل</a>
                    : <span>—</span>}
                  <span className="font-mono" dir="ltr">{e.rendered_at ? new Date(e.rendered_at).toLocaleDateString("ar") : ""}</span>
                  {outdated
                    ? <span className="rounded bg-amber-900/50 border border-amber-800 text-amber-300 px-1">قديم — تغيّرت البيانات</span>
                    : <span className="rounded bg-green-900/40 border border-green-800 text-green-300 px-1">محدّث</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
