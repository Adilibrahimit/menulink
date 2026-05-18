"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

// Lazy-loaded Leaflet GPS picker. Auto-attempts geolocation on mount, then
// shows a draggable pin so the customer can correct it. Calls onChange with
// the current lat/lng whenever the pin moves.
//
// Implementation note: Leaflet expects `window` and the marker-icon CSS to
// be available before rendering. We dynamic-import both inside an effect so
// SSR doesn't crash.
export default function LocationPicker({
  initial,
  onChange,
}: {
  initial: { lat: number; lng: number } | null;
  onChange: (loc: { lat: number; lng: number } | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "locating" | "denied" | "error" | "ready">("idle");

  useEffect(() => {
    let map: any = null;
    let marker: any = null;
    let mounted = true;

    async function init() {
      const L = (await import("leaflet")).default;
      if (!mounted || !containerRef.current) return;

      // Default to Riyadh until we resolve the user
      const start = initial ?? { lat: 24.7136, lng: 46.6753 };

      // Workaround for the well-known Leaflet "marker icon missing" bug
      // when bundled by webpack: explicitly set image paths to a CDN.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L.Icon.Default.prototype as any)._getIconUrl = undefined;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      map = L.map(containerRef.current, { zoomControl: true, attributionControl: false })
        .setView([start.lat, start.lng], 16);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      marker = L.marker([start.lat, start.lng], { draggable: true }).addTo(map);

      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChange({ lat: p.lat, lng: p.lng });
      });

      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      // Best-effort geolocation
      if (!initial && "geolocation" in navigator) {
        setStatus("locating");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 17);
            marker.setLatLng([lat, lng]);
            onChange({ lat, lng });
            setStatus("ready");
          },
          (err) => {
            setStatus(err.code === 1 ? "denied" : "error");
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
        );
      } else {
        setStatus("ready");
      }

      // First-mount layout fix (Leaflet often shows wrong size inside drawers)
      setTimeout(() => map?.invalidateSize(), 80);
    }

    init();

    return () => {
      mounted = false;
      if (map) map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        className="h-56 w-full rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100"
      />
      <p className="text-[11px] text-neutral-500 leading-relaxed">
        {status === "locating" && "جاري تحديد موقعك..."}
        {status === "denied" && "تعذّر الوصول للموقع. اسحب الدبوس لتحديد المكان."}
        {status === "error" && "تعذّر تحديد الموقع التلقائي. اسحب الدبوس على الخريطة."}
        {status === "ready" && "اسحب الدبوس على الخريطة لتعديل المكان."}
        {status === "idle" && "جاري تحميل الخريطة..."}
      </p>
    </div>
  );
}
