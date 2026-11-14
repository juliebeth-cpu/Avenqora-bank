import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const ICONS: Record<string, string> = {
  train: "🚆",
  ship: "🚢",
  bus: "🚌",
};

type JourneyMapFallback = {
  route?: any[];
  completedStopIds?: number[];
  transportType?: string | null;
  progress?: number;
  currentPosition?: { lat: number; lng: number } | null;
  schedule?: {
    departureAt?: string | null;
    durationMinutes?: number | null;
    active?: boolean;
  };
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function greatCirclePoint(from: [number, number], to: [number, number], progress: number) {
  const t = clamp(progress);
  const toRad = (value: number) => value * Math.PI / 180;
  const toDeg = (value: number) => value * 180 / Math.PI;
  const phi1 = toRad(from[0]), phi2 = toRad(to[0]);
  const lambda1 = toRad(from[1]), lambda2 = toRad(to[1]);
  const deltaPhi = phi2 - phi1, deltaLambda = lambda2 - lambda1;
  const a = Math.sin(deltaPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const distance = 2 * Math.asin(Math.sqrt(a));
  if (distance === 0) return { lat: from[0], lng: from[1] };
  const A = Math.sin((1 - t) * distance) / Math.sin(distance);
  const B = Math.sin(t * distance) / Math.sin(distance);
  const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
  const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
  const z = A * Math.sin(phi1) + B * Math.sin(phi2);
  return {
    lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lng: toDeg(Math.atan2(y, x)),
  };
}

function routeBearing(from: [number, number], to: [number, number], progress: number) {
  const t = clamp(progress);
  const point = greatCirclePoint(from, to, t);
  const lookAt = t >= 1
    ? greatCirclePoint(from, to, Math.max(0, t - 0.001))
    : greatCirclePoint(from, to, Math.min(1, t + 0.001));
  const start = t >= 1 ? lookAt : point;
  const end = t >= 1 ? point : lookAt;
  const toRad = (value: number) => value * Math.PI / 180;
  const deltaLambda = toRad(end.lng - start.lng);
  const phi1 = toRad(start.lat), phi2 = toRad(end.lat);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2)
    - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function validPosition(value: unknown): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    ? { lat, lng }
    : null;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function flightIcon(degrees: number, photoUrl?: string | null) {
  const photo = photoUrl
    ? `<div style="width:30px;height:30px;border-radius:50%;overflow:hidden;border:2px solid #fff;background:#0f172a;box-shadow:0 1px 5px rgba(0,0,0,.7);margin-bottom:1px"><img src="${escapeAttribute(photoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover" /></div>`
    : "";
  return L.divIcon({
    html:
      `<div data-flight-marker style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:${photo ? 48 : 44}px;height:${photo ? 82 : 48}px">` +
      photo +
      `<div data-flight-plane style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;transform:rotate(${degrees}deg);transform-origin:center">` +
      `<svg width="38" height="38" viewBox="0 0 24 24" fill="#000000" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 6px rgba(255,255,255,0.65))">` +
      `<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>` +
      `</svg></div></div>`,
    className: "",
    iconSize: photo ? [48, 82] : [44, 48],
    iconAnchor: photo ? [24, 66] : [22, 24],
  });
}

function photoIcon(photoUrl: string) {
  return L.divIcon({
    html: `<div style="width:42px;height:42px;border-radius:50%;overflow:hidden;border:3px solid white;background:#0f172a;box-shadow:0 2px 10px rgba(0,0,0,.6)"><img src="${escapeAttribute(photoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover" /></div>`,
    className: "",
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
}

function dotIcon(color: string, terminal = false) {
  return L.divIcon({
    html: `<div style="width:${terminal ? 56 : 16}px;height:${terminal ? 56 : 16}px;border-radius:50%;background:${terminal ? `${color}22` : color};border:3px solid ${terminal ? color : "white"};box-shadow:0 2px 8px rgba(0,0,0,.65)"></div>`,
    className: "",
    iconSize: terminal ? [56, 56] : [16, 16],
    iconAnchor: terminal ? [28, 28] : [8, 8],
  });
}

function locationPinIcon(title: string, subtitle?: string | null) {
  const safeTitle = escapeAttribute(title || "Location");
  const safeSubtitle = subtitle ? escapeAttribute(subtitle) : "";
  return L.divIcon({
    html:
      `<div style="display:flex;align-items:center;gap:5px;min-width:24px;transform:translateY(-3px)">` +
      `<div style="position:relative;width:24px;height:30px;flex:none">` +
      `<div style="position:absolute;left:2px;top:0;width:20px;height:20px;border-radius:50% 50% 50% 0;background:#dc2626;border:2px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.7);transform:rotate(-45deg)">` +
      `<div style="position:absolute;left:6px;top:6px;width:5px;height:5px;border-radius:50%;background:#fff;transform:rotate(45deg)"></div>` +
      `</div></div>` +
      `<div style="max-width:170px;padding:4px 7px;border-radius:5px;background:rgba(15,23,42,.92);border:1px solid rgba(248,250,252,.45);color:#f8fafc;font:600 11px/1.2 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 7px rgba(0,0,0,.5)">` +
      `<div>${safeTitle}</div>` +
      (safeSubtitle ? `<div style="margin-top:2px;color:#fecaca;font-size:10px;font-weight:500">${safeSubtitle}</div>` : "") +
      `</div></div>`,
    className: "",
    iconSize: [205, 34],
    iconAnchor: [12, 30],
  });
}

function waypointDetails(point: any, includeName = false): string {
  const values = [
    includeName ? point.name : null,
    point.city,
    point.country,
    point.locationIdentifier ?? point.code,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return values.join(" · ");
}

export default function TrackingJourneyMap({
  simulation,
  fallback,
  journeyType,
  websiteType,
  photoUrl,
}: {
  simulation?: any;
  fallback?: JourneyMapFallback;
  journeyType?: string | null;
  websiteType?: string | null;
  photoUrl?: string | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fittedRouteKeyRef = useRef<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const hasRoute = simulation?.route?.length >= 2 || Boolean(fallback?.route && fallback.route.length >= 2);
  const displayDepartureMs = fallback?.schedule?.departureAt
    ? new Date(fallback.schedule.departureAt).getTime()
    : NaN;
  const displayDurationMs = Number(fallback?.schedule?.durationMinutes) * 60_000;
  const displayProgress = fallback?.schedule?.active === true
    && Number.isFinite(displayDepartureMs)
    && Number.isFinite(displayDurationMs)
    && displayDurationMs > 0
    ? clamp((Date.now() - displayDepartureMs) / displayDurationMs)
    : clamp(Number(simulation?.progress ?? fallback?.progress ?? 0));

  // Create Leaflet once. Polling updates only replace the dynamic layer group;
  // destroying the map during a pan/zoom animation causes Leaflet's
  // getPosition(undefined) / "leaflet_pos" crash.
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    delete (L.Icon.Default.prototype as any)._getIconUrl;

    const map = L.map(mapRef.current, {
      minZoom: websiteType === "tracking" ? 1 : 2,
      maxZoom: 18,
      zoomControl: true,
      scrollWheelZoom: true,
      touchZoom: true,
    }).setView([20, 10], 2);
    mapInstanceRef.current = map;

    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles © Esri",
      maxZoom: 18,
    }).addTo(map);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18,
    }).addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);

    const invalidateSize = () => {
      if (mapInstanceRef.current === map) map.invalidateSize({ pan: false, animate: false });
    };
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(invalidateSize)
      : null;
    if (resizeObserver && mapRef.current) resizeObserver.observe(mapRef.current);
    const onFullscreenChange = () => requestAnimationFrame(invalidateSize);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    requestAnimationFrame(invalidateSize);

    return () => {
      resizeObserver?.disconnect();
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      currentMarkerRef.current = null;
      routeLayerRef.current?.clearLayers();
      markerLayerRef.current?.clearLayers();
      routeLayerRef.current = null;
      markerLayerRef.current = null;
      // Stop pending pan/fly-to work before removing the map DOM.
      map.stop();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update route and marker layers without resetting the user's map view.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeLayer = routeLayerRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !routeLayer || !markerLayer) return;

    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    routeLayer.clearLayers();
    markerLayer.clearLayers();
    currentMarkerRef.current = null;

    const simulationRoute = Array.isArray(simulation?.route) ? simulation.route.filter((p: any) =>
      Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
    ) : [];
    const fallbackRoute = Array.isArray(fallback?.route) ? fallback.route.filter((p: any) =>
      Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
    ) : [];
    const route = simulationRoute.length >= 2 ? simulationRoute : fallbackRoute;
    const points = route.map((p: any) => [Number(p.latitude), Number(p.longitude)] as [number, number]);
    if (points.length < 2) return;

    const transportType = String(simulation?.transportType ?? fallback?.transportType ?? "").toLowerCase();
    const isPackageTracking = websiteType === "tracking";
    const mapPoints = simulationRoute.length >= 2 || transportType !== "flight" || points.length !== 2
      ? points
      : Array.from({ length: 121 }, (_, index) => {
          const point = greatCirclePoint(points[0], points[1], index / 120);
          return [point.lat, point.lng] as [number, number];
        });

    if (isPackageTracking) {
      // Package Tracking uses a thick dotted route. The white casing keeps the
      // black dots readable over satellite imagery without joining them.
      L.polyline(mapPoints, {
        color: "#ffffff",
        weight: 12,
        opacity: 0.7,
        interactive: false,
        dashArray: "2 12",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(routeLayer);
      L.polyline(mapPoints, {
        color: "#000000",
        weight: 7,
        opacity: 0.95,
        interactive: false,
        dashArray: "2 12",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(routeLayer);
    } else {
      L.polyline(mapPoints, {
        color: "#60a5fa",
        weight: 4,
        opacity: 0.75,
        dashArray: "8 7",
        interactive: false,
      }).addTo(routeLayer);
    }

    route.forEach((point: any, index: number) => {
      const isActiveStop = point.stopId != null && point.stopId === simulation?.activeStop?.stopId;
      if (isPackageTracking) {
        if (index === route.length - 1) {
          L.marker([Number(point.latitude), Number(point.longitude)], {
            icon: dotIcon("#ef4444", true),
            zIndexOffset: 700,
          }).bindTooltip(
            `Destination: ${waypointDetails(point, true) || point.name || "Destination"}`,
          ).addTo(markerLayer);
        }
        return;
      }
      const color = isActiveStop ? "#a78bfa" : index === 0 ? "#22c55e" : index === route.length - 1 ? "#ef4444" : "#f59e0b";
      L.marker([Number(point.latitude), Number(point.longitude)], {
        icon: dotIcon(color, isPackageTracking && index === route.length - 1),
        zIndexOffset: isPackageTracking && index === route.length - 1 ? 700 : 300,
      }).bindTooltip(
        `${index === 0 ? "Origin" : index === route.length - 1 ? "Destination" : isActiveStop ? "Active stop" : "Stop"}: ${point.name}`,
      ).addTo(markerLayer);
    });

    const from = points[0];
    const to = points[points.length - 1];
    const simulationPosition = validPosition(simulation?.currentPosition);
    const fallbackPosition = validPosition(fallback?.currentPosition);
    const departureMs = fallback?.schedule?.departureAt
      ? new Date(fallback.schedule.departureAt).getTime()
      : NaN;
    const durationMs = Number(fallback?.schedule?.durationMinutes) * 60_000;
    const hasFallbackSchedule = fallback?.schedule?.active === true
      && Number.isFinite(departureMs)
      && Number.isFinite(durationMs)
      && durationMs > 0;
    const initialProgress = hasFallbackSchedule
      ? clamp((Date.now() - departureMs) / durationMs)
      : clamp(Number(simulation?.progress ?? fallback?.progress ?? 0));
    const getPosition = (progress: number) =>
      simulationPosition
      ?? fallbackPosition
      ?? greatCirclePoint(from, to, progress);
    const current = getPosition(initialProgress);
    const normalizedJourneyType = String(journeyType ?? "").toLowerCase().replace(/[\s-]+/g, "_");
    const isTrackingFlight = transportType === "flight" && isPackageTracking;
    const isHuman = normalizedJourneyType === "human"
      || normalizedJourneyType === "human_being"
      || normalizedJourneyType === "person"
      || normalizedJourneyType === "traveler";
    const authoritativeHeading = Number(simulation?.headingDegrees);
    const heading = Number.isFinite(authoritativeHeading)
      ? authoritativeHeading
      : routeBearing(from, to, initialProgress);
    const completedStopIds = new Set<number>(
      (simulation?.completedStopIds ?? fallback?.completedStopIds ?? [])
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value)),
    );

    route.forEach((point: any, index: number) => {
      const isOrigin = index === 0;
      const isDestination = index === route.length - 1;
      const isStop = point.stopId != null && !isOrigin && !isDestination;
      const isReachedStop = isStop && (
        completedStopIds.has(Number(point.stopId))
        || point.stopId === simulation?.activeStop?.stopId
      );
      if (isPackageTracking && (isOrigin || isReachedStop)) {
        const subtitle = isOrigin
          ? point.country || point.countryCode || "Origin"
          : waypointDetails(point, false);
        L.marker([Number(point.latitude), Number(point.longitude)], {
          icon: locationPinIcon(isOrigin ? (point.name || "Origin") : (point.name || "Stopover"), subtitle),
          zIndexOffset: 800,
        }).bindTooltip(
          `${isOrigin ? "Origin" : "Stopover"}: ${waypointDetails(point, true) || point.name || "Location"}`,
        ).addTo(markerLayer);
      }
    });

    if (current) {
      const currentMarker = L.marker([current.lat, current.lng], {
        zIndexOffset: 1000,
        icon: isTrackingFlight
          ? flightIcon(heading, photoUrl)
          : photoUrl
            ? photoIcon(photoUrl)
            : L.divIcon({
              html: `<div style="font-size:28px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;text-shadow:0 0 5px #fff">${ICONS[transportType] ?? (isHuman ? "●" : "📦")}</div>`,
              className: "",
              iconSize: [38, 38],
              iconAnchor: [19, 19],
            }),
      }).bindTooltip(
        `${transportType || "Journey"} · ${Math.round(initialProgress * 100)}% · ${simulation?.currentLocation?.name ?? "Current position"}`,
      ).addTo(markerLayer);
      currentMarkerRef.current = currentMarker;

      // Only use a client animation when the server did not provide its
      // authoritative current position. This avoids a competing progress
      // engine while retaining movement for legacy flight records.
      if (isTrackingFlight && hasFallbackSchedule && !simulationPosition) {
        const animate = () => {
          const progress = clamp((Date.now() - departureMs) / durationMs);
          const position = getPosition(progress);
          currentMarker.setLatLng([position.lat, position.lng]);
          const plane = currentMarker.getElement()?.querySelector("[data-flight-plane]") as HTMLElement | null;
          if (plane) plane.style.transform = `rotate(${routeBearing(from, to, progress)}deg)`;
          if (progress < 1 && mapInstanceRef.current === map) {
            animationFrameRef.current = requestAnimationFrame(animate);
          }
        };
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    }

    const routeKey = (mapPoints as [number, number][])
      .map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join("|");
    if (fittedRouteKeyRef.current !== routeKey) {
      fittedRouteKeyRef.current = routeKey;
      requestAnimationFrame(() => {
        if (mapInstanceRef.current !== map) return;
        map.stop();
        map.invalidateSize({ pan: false, animate: false });
        map.fitBounds(L.latLngBounds(mapPoints), { padding: [50, 50], maxZoom: 8, animate: false });
      });
    }
  }, [simulation, fallback, journeyType, websiteType, photoUrl]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: fullscreen ? 0 : 12,
        border: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <div
        ref={mapRef}
        aria-label={`${simulation?.transportType ?? fallback?.transportType ?? "Journey"} route map`}
        role="img"
        style={{ width: "100%", height: fullscreen ? "100vh" : "clamp(280px, 42vw, 440px)", background: "#111827" }}
      />
      <button
        onClick={toggleFullscreen}
        style={{
          position: "absolute",
          right: 10,
          bottom: 30,
          zIndex: 1000,
          display: "flex",
          gap: 5,
          alignItems: "center",
          padding: "5px 8px",
          borderRadius: 4,
          border: "1px solid #cbd5e1",
          background: "white",
          color: "#1f2937",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {fullscreen ? <><Minimize2 size={12} /> Exit</> : <><Maximize2 size={12} /> Fullscreen</>}
      </button>
      {!hasRoute && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#cbd5e1", pointerEvents: "none" }}>
          Configure origin and destination coordinates to show the route.
        </div>
      )}
      {hasRoute && (
        <div style={{ position: "absolute", left: 10, top: 10, zIndex: 1000, padding: "7px 9px", borderRadius: 7, color: "#e2e8f0", background: "rgba(15,23,42,.84)", fontSize: 11, lineHeight: 1.5 }}>
          <div><strong>{simulation?.transportType ?? fallback?.transportType ?? "Journey"}</strong> · {Math.round(displayProgress * 100)}% complete</div>
          <div style={{ color: "#94a3b8" }}>{simulation?.currentLocation?.name ?? "Current position"}{simulation?.activeStop ? ` · At ${simulation.activeStop.name}` : ""}</div>
        </div>
      )}
    </div>
  );
}