"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

// GPS location picker with:
//   - Explicit "Use my location" button (iOS Safari needs a user gesture;
//     auto-requesting on mount silently fails on iPhones)
//   - Permission-denied guidance per-platform (Safari/Chrome instructions)
//   - Drag-pin fallback that always works
//   - Map click to drop pin
//   - Multi-stage invalidateSize so the map renders cleanly inside a
//     drawer that animates open
//   - ResizeObserver to recover from any layout shift

type LocationStatus = "idle" | "locating" | "denied" | "unavailable" | "timeout" | "set";

export default function LocationPicker({
  initial,
  onChange,
}: {
  initial: { lat: number; lng: number } | null;
  onChange: (loc: { lat: number; lng: number } | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState<LocationStatus>(initial ? "set" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let observer: ResizeObserver | null = null;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!mounted || !containerRef.current) return;

      const start = initial ?? { lat: 24.7136, lng: 46.6753 }; // Riyadh fallback

      // Marker-icon webpack bug fix — use CDN-hosted icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false, // don't fight the drawer's vertical scroll
        touchZoom: true,
        doubleClickZoom: true,
      }).setView([start.lat, start.lng], 16);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([start.lat, start.lng], {
        draggable: true,
        autoPan: true,
      }).addTo(map);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChange({ lat: p.lat, lng: p.lng });
        setStatus("set");
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        map.setView(e.latlng, Math.max(map.getZoom(), 16));
        onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
        setStatus("set");
      });

      mapRef.current = map;
      markerRef.current = marker;

      // Drawer-friendly: invalidate size at multiple checkpoints
      // (initial mount, mid-animation, end-animation, settled)
      [60, 280, 600, 1200].forEach((ms) => setTimeout(() => map?.invalidateSize(), ms));

      // Catch any later layout shifts (orientation change, drawer resize)
      if (containerRef.current && "ResizeObserver" in window) {
        observer = new ResizeObserver(() => {
          map?.invalidateSize();
        });
        observer.observe(containerRef.current);
      }
    }

    init();

    return () => {
      mounted = false;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      setErrorMessage("متصفحك لا يدعم خدمة تحديد الموقع.");
      return;
    }

    setStatus("locating");
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([lat, lng], 17);
          markerRef.current.setLatLng([lat, lng]);
        }
        onChange({ lat, lng });
        setStatus("set");
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setStatus("denied");
            break;
          case err.POSITION_UNAVAILABLE:
            setStatus("unavailable");
            setErrorMessage("تعذّر تحديد موقعك. تحقق من تشغيل خدمات الموقع.");
            break;
          case err.TIMEOUT:
            setStatus("timeout");
            setErrorMessage("استغرق تحديد الموقع وقتاً طويلاً. حاول مرة أخرى.");
            break;
          default:
            setStatus("unavailable");
            setErrorMessage("حدث خطأ غير متوقع. اسحب الدبوس يدوياً.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  const isPinned = status === "set";

  return (
    <div className="space-y-2">
      {/* Map */}
      <div
        ref={containerRef}
        className="relative h-64 w-full rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100"
        style={{ touchAction: "manipulation" }}
      >
        {/* Pinned overlay badge */}
        {isPinned && (
          <div className="absolute top-2 right-2 z-[400] bg-green-600 text-white text-[11px] font-bold px-2 py-1 rounded-full shadow-md pointer-events-none">
            ✓ موقع محدد
          </div>
        )}
      </div>

      {/* Primary action: use current location */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={requestLocation}
          disabled={status === "locating"}
          className="flex-1 h-11 rounded-xl bg-[var(--brand)] text-white text-sm font-extrabold hover:opacity-90 disabled:opacity-60 active:translate-y-px shadow-sm"
        >
          {status === "locating" ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
              جاري تحديد موقعك...
            </span>
          ) : isPinned ? (
            "📍 إعادة تحديد موقعي الحالي"
          ) : (
            "📍 استخدم موقعي الحالي"
          )}
        </button>
      </div>

      {/* Hint */}
      {status === "idle" && (
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          اضغط الزر أعلاه لتحديد موقعك تلقائياً، أو اسحب الدبوس الأزرق على الخريطة لتعديل الموقع يدوياً.
        </p>
      )}

      {/* Permission denied — platform-specific recovery */}
      {status === "denied" && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs leading-relaxed">
          <div className="font-extrabold text-amber-900 mb-1.5 flex items-center gap-1">
            <span>⚠️</span>
            <span>تم رفض إذن الوصول للموقع</span>
          </div>
          <p className="text-amber-900/90 mb-2">
            لتفعيل خدمة الموقع للمتصفح، اتبع هذه الخطوات حسب جهازك:
          </p>
          <ul className="space-y-1.5 text-amber-900/85 list-none">
            <li>
              <b className="text-amber-900">📱 آيفون (Safari):</b><br />
              الإعدادات → Safari → الموقع → السماح
            </li>
            <li>
              <b className="text-amber-900">🤖 أندرويد (Chrome):</b><br />
              اضغط على 🔒 بجانب الرابط أعلى الصفحة → الموقع → السماح
            </li>
            <li className="pt-1 border-t border-amber-200">
              💡 أو اسحب الدبوس الأزرق يدوياً على الخريطة لتحديد المكان.
            </li>
          </ul>
        </div>
      )}

      {/* Other errors */}
      {(status === "unavailable" || status === "timeout") && errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs leading-relaxed">
          <div className="font-extrabold text-red-700 mb-1">{errorMessage}</div>
          <p className="text-red-700/85">اسحب الدبوس على الخريطة يدوياً لتحديد العنوان.</p>
        </div>
      )}

      {/* Pinned confirmation */}
      {isPinned && (
        <p className="text-[11px] text-green-700 font-semibold leading-relaxed flex items-center gap-1">
          <span>✓</span>
          <span>تم تحديد موقع التوصيل. يمكنك سحب الدبوس لتعديله.</span>
        </p>
      )}
    </div>
  );
}
