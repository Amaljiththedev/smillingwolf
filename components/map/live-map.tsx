"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { Box, Compass, Locate, Map as MapIcon, Minus, Mountain, Plus, Satellite } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Bounds } from "@/lib/geo";
import { BASEMAPS, DEM, buildStyle, type Basemap } from "@/lib/map-styles";
import { cn } from "@/lib/utils";

/*
  A real map (MapLibre, open source) with satellite, street and terrain base
  maps, optional 3D ground and buildings, and frosted-glass controls.

  - pins:    comment markers, coloured by sentiment
  - area:    the scheme's footprint, drawn as a precise outline
  - labels:  named places in the proposals (Market Square, ...)
  - overlay: images laid on the ground (the client's plan drawings)
  - mode "heat": a heatmap of the pins instead of markers
*/

export type Pin = { id: string | number; lng: number; lat: number; tone: "pos" | "neg" | ""; label?: string };
export type OverlayImage = { key: string; url: string; visible: boolean };
/** Image corners as [lng, lat]: top-left, top-right, bottom-right, bottom-left. */
export type Corners = [[number, number], [number, number], [number, number], [number, number]];
/** "site": the map stays on the scheme. "wide": visitors can explore the wider area. */
export type MapReach = "site" | "wide";
export type MapLabel = { key: string; lng: number; lat: number; text: string };

/** Glass panel classes, shared by every floating control on a map. */
export const glass =
  "rounded-xl border border-white/50 bg-white/65 shadow-[0_10px_34px_-14px_rgba(19,23,19,0.5)] backdrop-blur-xl backdrop-saturate-150";

const BASEMAP_ICONS = { streets: MapIcon, terrain: Mountain, aerial: Satellite } as const;

/*
  Keeping the map on the site.
  - Panning stops REACH_METRES beyond the site (or beyond the plan area when
    there is one), so the map can never drift to another street or town.
  - Zooming out stops ZOOM_OUT levels below the default view, worked out after
    the first framing, so the whole scheme stays the subject.
  - Scroll-wheel zoom needs Ctrl/Cmd and touch panning needs two fingers
    (MapLibre's cooperative gestures), so scrolling down the page or brushing
    the trackpad never zooms the map by accident.
*/
const REACH_METRES = 700;
const ZOOM_OUT = 1.25;
const FLOOR_ZOOM = 13;
/* "Wider area": roughly a whole region, still never the whole world. */
const WIDE_MIN_ZOOM = 8;

/** A box REACH_METRES beyond the centre (or area), as [[west, south], [east, north]]. */
function limits([lat, lng]: [number, number], area?: Bounds): [[number, number], [number, number]] {
  const dLat = REACH_METRES / 111_320;
  const dLng = REACH_METRES / (111_320 * Math.cos((lat * Math.PI) / 180));
  const west = area ? Math.min(area.west, lng) : lng;
  const east = area ? Math.max(area.east, lng) : lng;
  const south = area ? Math.min(area.south, lat) : lat;
  const north = area ? Math.max(area.north, lat) : lat;
  return [
    [west - dLng, south - dLat],
    [east + dLng, north + dLat],
  ];
}

/* SVG drawings are drawn to a PNG once, so the map can use them as an image source. */
const rasterCache = new Map<string, Promise<string>>();
function rasterise(url: string, aspect: number): Promise<string> {
  let job = rasterCache.get(url);
  if (!job) {
    job = (async () => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const w = 2400;
      const ratio = img.naturalWidth && img.naturalHeight ? img.naturalHeight / img.naturalWidth : aspect;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = Math.round(w * ratio);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    })();
    rasterCache.set(url, job);
    job.catch(() => rasterCache.delete(url));
  }
  return job;
}

function firstLabelLayer(map: MapLibreMap): string | undefined {
  return map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
}

export function LiveMap({
  centre,
  zoom = 16,
  pins,
  area,
  labels = [],
  overlay,
  overlayOpacity = 0.9,
  fit,
  activeId = null,
  focusId = null,
  onHover,
  onSelect,
  mode = "pins",
  basemap: initialBasemap = "streets",
  threeD: initialThreeD = false,
  still = false,
  padding,
  reach = "site",
  className,
  children,
}: {
  /** [lat, lng] */
  centre: [number, number];
  zoom?: number;
  pins: Pin[];
  area?: Bounds;
  labels?: MapLabel[];
  overlay?: { images: OverlayImage[]; bounds: Bounds; aspect: number; corners?: Corners };
  overlayOpacity?: number;
  /** Frame these bounds on load and when "recentre" is pressed. */
  fit?: Bounds;
  activeId?: Pin["id"] | null;
  /** Fly to this pin when it changes. */
  focusId?: Pin["id"] | null;
  onHover?: (id: Pin["id"] | null) => void;
  onSelect?: (id: Pin["id"] | null) => void;
  mode?: "pins" | "heat";
  basemap?: Basemap;
  threeD?: boolean;
  /** A still preview: no panning, zooming or controls. Follows the basemap and threeD props. */
  still?: boolean;
  /** Room kept clear of floating panels when framing, in px. */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Keep the map on the site (default) or let visitors see the wider area. */
  reach?: MapReach;
  className?: string;
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const labelMarkers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [styleVersion, setStyleVersion] = useState(0);
  /* True between a style finishing loading and the next style swap. */
  const styleReady = useRef(false);
  const [chosenBasemap, setBasemap] = useState<Basemap>(initialBasemap);
  const [chosenThreeD, setThreeD] = useState(initialThreeD);
  /* A still preview simply mirrors its props (the builder's inspector drives them). */
  const basemap = still ? initialBasemap : chosenBasemap;
  const threeD = still ? initialThreeD : chosenThreeD;

  /* Latest callbacks and options, read from map events without re-creating the map. */
  const live = useRef({ onHover, onSelect, fit, padding, centre, zoom, threeD, reach, area });
  useEffect(() => {
    live.current = { onHover, onSelect, fit, padding, centre, zoom, threeD, reach, area };
  });

  function frame(animate: boolean) {
    const map = mapRef.current;
    if (!map) return;
    const { fit: f, padding: p, centre: c, zoom: z, threeD: tilt } = live.current;
    const pad = { top: 24, right: 24, bottom: 24, left: 24, ...p };
    const view = { pitch: tilt ? 58 : 0, bearing: tilt ? -18 : 0 };
    if (f) {
      const camera = map.cameraForBounds(
        [
          [f.west, f.south],
          [f.east, f.north],
        ],
        { padding: pad },
      );
      if (camera) map.easeTo({ ...camera, ...view, duration: animate ? 1000 : 0 });
    } else {
      map.easeTo({ center: [c[1], c[0]], zoom: z, padding: pad, ...view, duration: animate ? 1000 : 0 });
    }
  }

  /* Create the map once. */
  useEffect(() => {
    let cancelled = false;
    const markerMap = markers.current;
    (async () => {
      const [lib, style] = await Promise.all([import("maplibre-gl"), buildStyle(initialBasemap)]);
      if (cancelled || !box.current) return;
      /* The bundler cannot follow MapLibre's worker import, so it is served from
         /public (copied there on npm install). */
      lib.setWorkerUrl("/maplibre-gl-worker.mjs");
      libRef.current = lib;
      const { centre: c, zoom: z, fit: f, reach: r } = live.current;
      const map = new lib.Map({
        container: box.current,
        style,
        center: [c[1], c[0]],
        zoom: z,
        maxZoom: 19.5,
        minZoom: r === "wide" ? WIDE_MIN_ZOOM : FLOOR_ZOOM,
        maxPitch: 75,
        /* Stay on the site: no wandering off to another street or town. */
        maxBounds: r === "wide" ? undefined : limits(c, f ?? area),
        interactive: !still,
        cooperativeGestures: !still,
        locale: {
          "CooperativeGesturesHandler.WindowsHelpText": "Hold Ctrl and scroll to zoom the map",
          "CooperativeGesturesHandler.MacHelpText": "Hold ⌘ and scroll to zoom the map",
          "CooperativeGesturesHandler.MobileHelpText": "Use two fingers to move the map",
        },
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on("style.load", () => {
        styleReady.current = true;
        setStyleVersion((v) => v + 1);
      });
      map.once("load", () => {
        frame(false);
        /* Zoom-out stops a little past the default view, whatever that view is. */
        map.once("idle", () => {
          if (live.current.reach === "site") map.setMinZoom(Math.max(FLOOR_ZOOM, map.getZoom() - ZOOM_OUT));
        });
        /* Gentler wheel zoom than the default, so one flick is one small step. */
        map.scrollZoom.setWheelZoomRate(1 / 700);
        map.scrollZoom.setZoomRate(1 / 200);
        setReady(true);
      });
      map.on("click", () => live.current.onSelect?.(null));
      map.on("error", (event) => console.error("[map]", event.error?.message ?? event));
    })();
    return () => {
      cancelled = true;
      markerMap.forEach(({ marker }) => marker.remove());
      markerMap.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // The map is built once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Swap the base map. Our own layers are re-added on the next style.load. */
  const appliedBasemap = useRef<Basemap>(initialBasemap);
  useEffect(() => {
    if (!ready || appliedBasemap.current === basemap) return;
    appliedBasemap.current = basemap;
    let cancelled = false;
    buildStyle(basemap).then((style) => {
      if (cancelled || !mapRef.current) return;
      styleReady.current = false;
      mapRef.current.setStyle(style, { diff: false });
    });
    return () => {
      cancelled = true;
    };
  }, [basemap, ready]);

  /* 3D: real ground height, extruded buildings, a soft sky, and a tilted camera. */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !styleReady.current) return;
    if (threeD) {
      if (!map.getSource("op-dem")) map.addSource("op-dem", DEM);
      map.setTerrain({ source: "op-dem", exaggeration: 1.4 });
      if (map.getSource("openmaptiles") && !map.getLayer("op-buildings")) {
        map.addLayer(
          {
            id: "op-buildings",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#e3ded5",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.9,
              "fill-extrusion-vertical-gradient": true,
            },
          },
          firstLabelLayer(map),
        );
      }
      map.setSky({
        "sky-color": "#bfe0f5",
        "horizon-color": "#f2f4f6",
        "fog-color": "#f7f3f0",
        "sky-horizon-blend": 0.6,
        "horizon-fog-blend": 0.7,
        "fog-ground-blend": 0.4,
      });
      if (!still) map.dragRotate.enable();
    } else {
      map.setTerrain(null);
      if (map.getLayer("op-buildings")) map.removeLayer("op-buildings");
      if (!still) map.dragRotate.disable();
    }
    map.easeTo({ pitch: threeD ? 58 : 0, bearing: threeD ? -18 : 0, duration: still ? 0 : 1100 });
  }, [ready, styleVersion, threeD, still]);

  /* Switching between "keep to the site" and "wider area" after the map is built. */
  const appliedReach = useRef(reach);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || appliedReach.current === reach) return;
    appliedReach.current = reach;
    if (reach === "wide") {
      map.setMaxBounds(null);
      map.setMinZoom(WIDE_MIN_ZOOM);
    } else {
      const { centre: c, fit: f, area: a } = live.current;
      map.setMaxBounds(limits(c, f ?? a));
      map.setMinZoom(FLOOR_ZOOM);
      frame(true);
    }
  }, [reach, ready]);

  /* The scheme footprint: faint fill under the names, and a white-cased coral
     dashed line on top of everything so roads and buildings never hide it. */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !area || !styleReady.current) return;
    const ring = [
      [area.west, area.north],
      [area.east, area.north],
      [area.east, area.south],
      [area.west, area.south],
      [area.west, area.north],
    ];
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "Polygon" as const, coordinates: [ring] },
    };
    const source = map.getSource("op-area");
    if (source && "setData" in source) {
      (source as unknown as { setData: (d: typeof data) => void }).setData(data);
      return;
    }
    const before = firstLabelLayer(map);
    map.addSource("op-area", { type: "geojson", data });
    map.addLayer({ id: "op-area-fill", type: "fill", source: "op-area", paint: { "fill-color": "#ff8c88", "fill-opacity": 0.08 } }, before);
    map.addLayer(
      { id: "op-area-casing", type: "line", source: "op-area", paint: { "line-color": "#ffffff", "line-width": 4.5, "line-opacity": 0.85 } },
    );
    map.addLayer(
      {
        id: "op-area-line",
        type: "line",
        source: "op-area",
        paint: { "line-color": "#ff6b66", "line-width": 2.2, "line-dasharray": [2.2, 1.6] },
      },
    );
  }, [ready, styleVersion, area]);

  /* Plan drawings laid on the ground, under the street names. */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !styleReady.current) return;
    if (!overlay) {
      for (const layer of map.getStyle().layers ?? []) {
        if (!layer.id.startsWith("overlay-")) continue;
        map.removeLayer(layer.id);
        if (map.getSource(layer.id)) map.removeSource(layer.id);
      }
      return;
    }
    let cancelled = false;
    const b = overlay.bounds;
    const coordinates: Corners = overlay.corners ?? [
      [b.west, b.north],
      [b.east, b.north],
      [b.east, b.south],
      [b.west, b.south],
    ];
    /* Drop images from a plan that has since been replaced or removed. */
    const keep = new Set(overlay.images.map((image) => `overlay-${image.key}`));
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.id.startsWith("overlay-") && !keep.has(layer.id)) {
        map.removeLayer(layer.id);
        if (map.getSource(layer.id)) map.removeSource(layer.id);
      }
    }
    (async () => {
      for (const image of overlay.images) {
        const id = `overlay-${image.key}`;
        if (!image.visible && !map.getLayer(id)) continue;
        const existing = map.getSource(id);
        /* The plan was moved (new grid references): shift it without redrawing. */
        if (existing && "setCoordinates" in existing) {
          (existing as unknown as { setCoordinates: (c: Corners) => void }).setCoordinates(coordinates);
        }
        if (!existing) {
          let url: string;
          try {
            /* SVG drawings are drawn to PNG first; photos and WebP layers go straight on. */
            url = /^data:image\/svg|\.svg(\?|#|$)/i.test(image.url) ? await rasterise(image.url, overlay.aspect) : image.url;
          } catch {
            continue;
          }
          if (cancelled || map.getSource(id)) continue;
          map.addSource(id, { type: "image", url, coordinates });
          map.addLayer(
            { id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-fade-duration": 0 } },
            map.getLayer("op-area-fill") ? "op-area-fill" : firstLabelLayer(map),
          );
        }
        map.setPaintProperty(id, "raster-opacity", image.visible ? overlayOpacity : 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, styleVersion, overlay, overlayOpacity]);

  /* Heatmap of the pins. */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !styleReady.current) return;
    const data = {
      type: "FeatureCollection" as const,
      features: pins.map((p) => ({
        type: "Feature" as const,
        properties: { neg: p.tone === "neg" ? 1 : 0 },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      })),
    };
    const source = map.getSource("op-pins");
    if (source && "setData" in source) {
      (source as unknown as { setData: (d: typeof data) => void }).setData(data);
    } else if (!source) {
      map.addSource("op-pins", { type: "geojson", data });
      map.addLayer({
        id: "op-heat",
        type: "heatmap",
        source: "op-pins",
        paint: {
          "heatmap-weight": ["+", 0.6, ["*", 0.4, ["get", "neg"]]],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 13, 0.8, 18, 2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 13, 18, 18, 60],
          "heatmap-opacity": 0.85,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(255,140,136,0)",
            0.2,
            "rgba(255,210,191,0.55)",
            0.5,
            "rgba(255,140,136,0.78)",
            0.8,
            "rgba(229,90,84,0.88)",
            1,
            "rgba(120,20,20,0.9)",
          ],
        },
      });
    }
    map.setLayoutProperty("op-heat", "visibility", mode === "heat" ? "visible" : "none");
  }, [ready, styleVersion, pins, mode]);

  /* Markers: DOM buttons, so they are focusable and styled with CSS. */
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const next = new Set(pins.map((p) => String(p.id)));
    markers.current.forEach((entry, key) => {
      if (!next.has(key)) {
        entry.marker.remove();
        markers.current.delete(key);
      }
    });
    pins.forEach((pin, index) => {
      const key = String(pin.id);
      const existing = markers.current.get(key);
      if (existing) {
        existing.marker.setLngLat([pin.lng, pin.lat]);
        existing.el.dataset.tone = pin.tone;
        return;
      }
      const el = document.createElement("button");
      el.type = "button";
      el.className = "op-pin";
      el.dataset.tone = pin.tone;
      el.style.setProperty("--pin-delay", `${Math.min(index, 40) * 18}ms`);
      el.setAttribute("aria-label", pin.label ?? "Comment");
      if (still) el.tabIndex = -1;
      el.addEventListener("mouseenter", () => live.current.onHover?.(pin.id));
      el.addEventListener("mouseleave", () => live.current.onHover?.(null));
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        live.current.onSelect?.(pin.id);
      });
      const marker = new lib.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map);
      markers.current.set(key, { marker, el });
    });
  }, [ready, pins, still]);

  /* Place names from the proposals, as small glass tags. */
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    labelMarkers.current.forEach((m) => m.remove());
    labelMarkers.current = labels.map((label) => {
      const el = document.createElement("div");
      el.className =
        "pointer-events-none whitespace-nowrap rounded-full border border-white/60 bg-white/75 px-2.5 py-1 text-[11px] font-medium leading-none text-ink shadow-[0_4px_14px_-6px_rgba(19,23,19,0.55)] backdrop-blur-md";
      el.textContent = label.text;
      return new lib.Marker({ element: el, anchor: "bottom", offset: [0, -10] }).setLngLat([label.lng, label.lat]).addTo(map);
    });
    return () => {
      labelMarkers.current.forEach((m) => m.remove());
      labelMarkers.current = [];
    };
  }, [ready, labels]);

  useEffect(() => {
    markers.current.forEach(({ el }, key) => {
      el.dataset.active = String(activeId !== null && key === String(activeId));
      el.style.display = mode === "heat" ? "none" : "";
    });
  }, [activeId, mode, pins, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || focusId === null) return;
    const pin = pins.find((p) => p.id === focusId);
    if (!pin) return;
    const pad = { top: 24, right: 24, bottom: 24, left: 24, ...live.current.padding };
    map.easeTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 17.5), padding: pad, duration: 900 });
    // Only when the focused pin changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, ready]);

  return (
    <div className={cn("relative isolate overflow-hidden bg-[#f2efe9]", className)}>
      {/* Inline style: maplibre-gl.css sets position: relative on this element, which would beat a class. */}
      <div ref={box} style={{ position: "absolute", inset: 0 }} />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="animate-pulse font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/45">Loading map</span>
        </div>
      )}

      {!still && (
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
          <div role="group" aria-label="Base map" className={cn(glass, "flex gap-0.5 p-1")}>
            {BASEMAPS.map(({ key, label }) => {
              const Icon = BASEMAP_ICONS[key];
              const on = basemap === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setBasemap(key)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.75rem] font-medium transition-colors duration-200",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
                    on ? "bg-ink text-white" : "text-ink/70 hover:bg-white/70 hover:text-ink",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-start gap-2">
            <button
              type="button"
              aria-pressed={threeD}
              onClick={() => setThreeD((v) => !v)}
              className={cn(
                glass,
                "flex h-9 items-center gap-1.5 px-3 text-[0.75rem] font-medium transition-colors duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                threeD ? "!bg-ink text-white" : "text-ink hover:bg-white/80",
              )}
            >
              <Box className="size-3.5" aria-hidden="true" />
              3D
            </button>
            <div className={cn(glass, "flex flex-col overflow-hidden")}>
              <MapButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
                <Plus className="size-4" />
              </MapButton>
              <span className="mx-2 h-px bg-ink/10" />
              <MapButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
                <Minus className="size-4" />
              </MapButton>
              <span className="mx-2 h-px bg-ink/10" />
              <MapButton label="Recentre" onClick={() => frame(true)}>
                <Locate className="size-4" />
              </MapButton>
              {threeD && (
                <>
                  <span className="mx-2 h-px bg-ink/10" />
                  <MapButton label="Face north" onClick={() => mapRef.current?.easeTo({ bearing: 0, duration: 600 })}>
                    <Compass className="size-4" />
                  </MapButton>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 place-items-center text-ink/75 transition-colors hover:bg-white/70 hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
