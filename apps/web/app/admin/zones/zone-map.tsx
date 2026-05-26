"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

type ZoneMapProps = {
  branchLat: number | null;
  branchLng: number | null;
  areaType: "radius" | "polygon";
  radiusKm: number;
  polygonGeoJson: unknown | null;
  onBranchLocationChange: (lat: number, lng: number) => void;
  onPolygonChange: (geojson: unknown) => void;
};

const RIYADH: [number, number] = [24.7136, 46.6753];

export default function ZoneMap({
  branchLat,
  branchLng,
  areaType,
  radiusKm,
  polygonGeoJson,
  onBranchLocationChange,
  onPolygonChange,
}: ZoneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawnRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawControlRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      import("leaflet-draw").then(() => {
        const center: [number, number] = branchLat && branchLng
          ? [branchLat, branchLng]
          : RIYADH;

        const map = L.map(containerRef.current!, {
          center,
          zoom: 13,
          zoomControl: true,
          attributionControl: false,
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
        }).addTo(map);

        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        drawnRef.current = drawnItems;

        if (branchLat && branchLng) {
          const marker = L.marker([branchLat, branchLng], { draggable: true });
          marker.addTo(map);
          marker.on("dragend", () => {
            const pos = marker.getLatLng();
            onBranchLocationChange(pos.lat, pos.lng);
          });
          markerRef.current = marker;
        }

        map.on("click", (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            const marker = L.marker([lat, lng], { draggable: true });
            marker.addTo(map);
            marker.on("dragend", () => {
              const pos = marker.getLatLng();
              onBranchLocationChange(pos.lat, pos.lng);
            });
            markerRef.current = marker;
          }
          onBranchLocationChange(lat, lng);
        });

        if (polygonGeoJson && areaType === "polygon") {
          try {
            const layer = L.geoJSON(polygonGeoJson as GeoJSON.GeoJsonObject);
            layer.eachLayer((l) => drawnItems.addLayer(l));
          } catch { /* invalid geojson */ }
        }

        mapRef.current = map;
        setReady(true);

        setTimeout(() => map.invalidateSize(), 100);
        setTimeout(() => map.invalidateSize(), 500);
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
        drawnRef.current = null;
        drawControlRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }

      if (areaType === "radius" && branchLat && branchLng) {
        const circle = L.circle([branchLat, branchLng], {
          radius: radiusKm * 1000,
          color: "var(--brand, #D32027)",
          fillColor: "var(--brand, #D32027)",
          fillOpacity: 0.1,
          weight: 2,
          dashArray: "6 4",
        });
        circle.addTo(map);
        circleRef.current = circle;
      }
    });
  }, [ready, areaType, branchLat, branchLng, radiusKm]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    import("leaflet").then((L) => {
      import("leaflet-draw").then(() => {
        const map = mapRef.current;
        const drawnItems = drawnRef.current;

        if (drawControlRef.current) {
          map.removeControl(drawControlRef.current);
          drawControlRef.current = null;
        }

        if (areaType === "polygon") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const drawControl = new (L.Control as any).Draw({
            position: "topright",
            draw: {
              polyline: false,
              rectangle: false,
              circle: false,
              circlemarker: false,
              marker: false,
              polygon: {
                allowIntersection: false,
                shapeOptions: {
                  color: "var(--brand, #D32027)",
                  fillColor: "var(--brand, #D32027)",
                  fillOpacity: 0.15,
                  weight: 2,
                },
              },
            },
            edit: {
              featureGroup: drawnItems,
              remove: true,
            },
          });
          map.addControl(drawControl);
          drawControlRef.current = drawControl;

          map.off("draw:created");
          map.off("draw:edited");
          map.off("draw:deleted");

          map.on("draw:created", (e: { layer: L.Layer }) => {
            drawnItems.clearLayers();
            drawnItems.addLayer(e.layer);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const gj = (e.layer as any).toGeoJSON();
            onPolygonChange(gj.geometry);
          });
          map.on("draw:edited", () => {
            const layers = drawnItems.getLayers();
            if (layers.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const gj = (layers[0] as any).toGeoJSON();
              onPolygonChange(gj.geometry);
            }
          });
          map.on("draw:deleted", () => {
            onPolygonChange(null);
          });
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, areaType]);

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className="h-64 rounded-xl border border-neutral-200 overflow-hidden"
      />
      <p className="text-[10px] text-neutral-400">
        {areaType === "radius"
          ? "انقر على الخريطة لتحديد موقع الفرع. الدائرة تمثل نطاق التوصيل."
          : "انقر على الخريطة لتحديد موقع الفرع، ثم استخدم أداة الرسم لرسم حدود منطقة التوصيل."}
      </p>
    </div>
  );
}
