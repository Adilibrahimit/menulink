"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type LocationStatus = "idle" | "locating" | "denied" | "unavailable" | "timeout" | "set";

function getBrandColor(): string {
  if (typeof document === "undefined") return "#6366f1";
  return getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#6366f1";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createBrandIcon(L: any, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44" fill="none">
    <defs>
      <filter id="ds" x="0" y="2" width="32" height="44" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <g filter="url(#ds)">
      <path d="M16 2C9.373 2 4 7.373 4 14c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${color}"/>
      <circle cx="16" cy="14" r="5" fill="white"/>
    </g>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "location-brand-marker",
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -44],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createPulseRing(L: any, latlng: [number, number], color: string) {
  return L.divIcon({
    html: `<div class="location-pulse-ring" style="--pulse-color:${color}"></div>`,
    className: "location-pulse-container",
    iconSize: [60, 60],
    iconAnchor: [30, 30],
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`,
      { headers: { "User-Agent": "MenuLink/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name ?? null;
  } catch { return null; }
}

export default function LocationPicker({
  initial,
  onChange,
  onAddressResolved,
}: {
  initial: { lat: number; lng: number } | null;
  onChange: (loc: { lat: number; lng: number } | null) => void;
  onAddressResolved?: (address: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pulseRef = useRef<any>(null);
  const [status, setStatus] = useState<LocationStatus>(initial ? "set" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let observer: ResizeObserver | null = null;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!mounted || !containerRef.current) return;

      const brand = getBrandColor();
      const start = initial ?? { lat: 24.7136, lng: 46.6753 };

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        touchZoom: true,
        doubleClickZoom: true,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      }).setView([start.lat, start.lng], 16);

      L.control.zoom({ position: "bottomleft" }).addTo(map);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { maxZoom: 20, subdomains: "abcd" }
      ).addTo(map);

      const icon = createBrandIcon(L, brand);
      const marker = L.marker([start.lat, start.lng], {
        draggable: true,
        autoPan: true,
        icon,
        autoPanPadding: [40, 40],
      }).addTo(map);

      bounceMarker(marker);

      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChange({ lat: p.lat, lng: p.lng });
        setStatus("set");
        bounceMarker(marker);
        if (onAddressResolved) reverseGeocode(p.lat, p.lng).then((a) => { if (a) onAddressResolved(a); });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        map.flyTo(e.latlng, Math.max(map.getZoom(), 16), { duration: 0.5 });
        onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
        setStatus("set");
        bounceMarker(marker);
        if (onAddressResolved) reverseGeocode(e.latlng.lat, e.latlng.lng).then((a) => { if (a) onAddressResolved(a); });
      });

      mapRef.current = map;
      markerRef.current = marker;

      [60, 280, 600, 1200].forEach((ms) => setTimeout(() => map?.invalidateSize(), ms));

      if (containerRef.current && "ResizeObserver" in window) {
        observer = new ResizeObserver(() => map?.invalidateSize());
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
      pulseRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function bounceMarker(marker: any) {
    const el = marker.getElement?.();
    if (!el) return;
    el.style.transition = "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
    el.style.transform += " translateY(-12px)";
    setTimeout(() => {
      el.style.transform = el.style.transform.replace(" translateY(-12px)", "");
    }, 300);
  }

  async function showPulse(lat: number, lng: number) {
    const L = (await import("leaflet")).default;
    if (!mapRef.current) return;
    if (pulseRef.current) {
      mapRef.current.removeLayer(pulseRef.current);
    }
    const brand = getBrandColor();
    const pulseIcon = createPulseRing(L, [lat, lng], brand);
    pulseRef.current = L.marker([lat, lng], { icon: pulseIcon, interactive: false }).addTo(mapRef.current);
    setTimeout(() => {
      if (pulseRef.current && mapRef.current) {
        mapRef.current.removeLayer(pulseRef.current);
        pulseRef.current = null;
      }
    }, 2000);
  }

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
          mapRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
          markerRef.current.setLatLng([lat, lng]);
          bounceMarker(markerRef.current);
          showPulse(lat, lng);
        }
        onChange({ lat, lng });
        setStatus("set");
        if (onAddressResolved) reverseGeocode(lat, lng).then((a) => { if (a) onAddressResolved(a); });
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
      <style>{`
        .location-brand-marker {
          background: none !important;
          border: none !important;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.2));
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .location-brand-marker:hover {
          transform: scale(1.1);
        }
        .location-pulse-container {
          background: none !important;
          border: none !important;
        }
        .location-pulse-ring {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--pulse-color);
          opacity: 0.35;
          animation: locPulse 1.5s ease-out forwards;
        }
        @keyframes locPulse {
          0% { transform: scale(0.3); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .leaflet-control-zoom a {
          width: 34px !important;
          height: 34px !important;
          line-height: 34px !important;
          font-size: 16px !important;
          border-radius: 10px !important;
          background: white !important;
          color: #374151 !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;
          border: none !important;
          transition: all 0.2s ease !important;
        }
        .leaflet-control-zoom a:hover {
          background: #f9fafb !important;
          transform: scale(1.05);
        }
        .leaflet-control-zoom {
          border: none !important;
          border-radius: 12px !important;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
        }
      `}</style>

      <div
        ref={containerRef}
        className="relative h-64 w-full rounded-2xl overflow-hidden border border-neutral-200/60 bg-neutral-100 shadow-lg"
        style={{ touchAction: "manipulation" }}
      >
        {isPinned && (
          <div className="absolute top-3 right-3 z-[400] bg-green-600/90 backdrop-blur-sm text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg pointer-events-none flex items-center gap-1.5 animate-[fadeSlideIn_0.3s_ease-out]">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            موقع محدد
          </div>
        )}

        {status === "locating" && (
          <div className="absolute inset-0 z-[400] bg-black/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-xl flex items-center gap-3">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin"></span>
              <span className="text-sm font-semibold text-neutral-700">جاري تحديد الموقع...</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={requestLocation}
          disabled={status === "locating"}
          className="flex-1 h-11 rounded-xl bg-[var(--brand)] text-white text-sm font-extrabold hover:opacity-90 disabled:opacity-60 active:translate-y-px shadow-sm transition-all duration-200"
        >
          {status === "locating" ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
              جاري تحديد موقعك...
            </span>
          ) : isPinned ? (
            "إعادة تحديد موقعي الحالي"
          ) : (
            "استخدم موقعي الحالي"
          )}
        </button>
      </div>

      {status === "idle" && (
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          اضغط الزر أعلاه لتحديد موقعك تلقائياً، أو اسحب الدبوس على الخريطة لتعديل الموقع يدوياً.
        </p>
      )}

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
              💡 أو اسحب الدبوس يدوياً على الخريطة لتحديد المكان.
            </li>
          </ul>
        </div>
      )}

      {(status === "unavailable" || status === "timeout") && errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs leading-relaxed">
          <div className="font-extrabold text-red-700 mb-1">{errorMessage}</div>
          <p className="text-red-700/85">اسحب الدبوس على الخريطة يدوياً لتحديد العنوان.</p>
        </div>
      )}

      {isPinned && (
        <p className="text-[11px] text-green-700 font-semibold leading-relaxed flex items-center gap-1">
          <span>✓</span>
          <span>تم تحديد موقع التوصيل. يمكنك سحب الدبوس لتعديله.</span>
        </p>
      )}
    </div>
  );
}
