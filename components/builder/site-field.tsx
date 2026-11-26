"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature } from "maplibre-gl";
import { Check, MousePointerClick, PenLine, SquareDashed, Undo2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { GridInput } from "@/components/builder/plan-field";
import { buildStyle, hasAerial } from "@/lib/map-styles";
import { gridToLatLng, parseGridRef } from "@/lib/osgrid";
import {
  DEFAULT_CENTRE,
  LINE_SETS,
  PICKABLE_LAYERS,
  blankSite,
  describeArea,
  lineLayers,
  outlineArea,
  outlineBounds,
  type LineKey,
  type SiteArea,
} from "@/lib/site-map";
import { cn } from "@/lib/utils";

/*
  Inspector control for the scheme's site:
  - its OS grid reference (where the map opens),
  - its boundary: click an area on the map and the outline is taken from the
    map data (click again for the next bigger area), or draw it point by point,
  - which lines are drawn from the map data.
*/

export function SiteField({ value, onChange }: { value: SiteArea | null; onChange: (next: SiteArea) => void }) {
  const site = value ?? blankSite();
  const [marking, setMarking] = useState(false);
  const id = useId();
  const update = (patch: Partial<SiteArea>) => onChange({ ...site, ...patch });
  const area = outlineArea(site.outline);

  return (
    <div className="flex flex-col gap-3">
      <GridInput id={`${id}-ref`} label="Where the site is (OS grid reference)" value={site.ref} onChange={(ref) => update({ ref })} />

      <div className="flex flex-col gap-2 rounded-sw border border-ink/10 p-2.5">
        <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-ink/70">
          <SquareDashed className="size-3.5" aria-hidden="true" />
          Site boundary
        </p>
        {site.outline.length ? (
          <p className="flex items-start gap-1.5 text-[0.72rem] leading-snug text-ink/60">
            <Check className="mt-px size-3.5 shrink-0 text-olive" aria-hidden="true" />
            Marked: about {describeArea(area)}, {site.outline.length} points.
          </p>
        ) : (
          <p className="text-[0.72rem] leading-snug text-ink/55">Not marked yet. Click the site on the map and the outline is taken from the map data, or draw it.</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMarking(true)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-sw bg-ink px-3 text-[0.8rem] font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {site.outline.length ? "Change the boundary" : "Mark the boundary"}
          </button>
          {site.outline.length > 0 && (
            <button
              type="button"
              onClick={() => update({ outline: [] })}
              className="h-9 rounded-sw border border-ink/15 bg-white px-3 text-[0.78rem] text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-ink"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[0.72rem] text-ink/60">Lines drawn from the map. Ticked ones show when the page opens; visitors can switch any of them.</legend>
        {LINE_SETS.map((set) => (
          <label key={set.key} className="flex items-center gap-2 text-[0.8rem] text-ink">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              checked={site.lines.includes(set.key)}
              onChange={(event) =>
                update({ lines: event.target.checked ? [...site.lines, set.key] : site.lines.filter((key) => key !== set.key) })
              }
            />
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: SWATCH[set.key] }} aria-hidden="true" />
            {set.label}
          </label>
        ))}
      </fieldset>

      {marking && (
        <BoundaryDialog
          site={site}
          onClose={() => setMarking(false)}
          onSave={(outline) => {
            update({ outline });
            setMarking(false);
          }}
        />
      )}
    </div>
  );
}

const SWATCH: Record<LineKey, string> = {
  paths: "#b4524c",
  roads: "#bdbab4",
  buildings: "#4a4a46",
  green: "#7fa35a",
  water: "#6a96b8",
};

/* ---------- The boundary map ---------- */

type Mode = "pick" | "draw";
type Ring = [number, number][];

function inRing([x, y]: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The outer rings of the shapes under a point, smallest first. */
function shapesAt(features: MapGeoJSONFeature[], at: [number, number]): Ring[] {
  const rings: Ring[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const g = feature.geometry;
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const polygon of polygons) {
      const outer = polygon[0] as number[][];
      if (!outer || outer.length < 4 || !inRing(at, outer)) continue;
      const ring = outer.slice(0, -1).map((p) => [p[0], p[1]] as [number, number]);
      const sig = ring.map((p) => p.map((n) => n.toFixed(6)).join()).join("|");
      if (seen.has(sig)) continue;
      seen.add(sig);
      rings.push(ring);
    }
  }
  /* Whole districts are never a site. */
  return rings.filter((r) => outlineArea(r) < 3_000_000).sort((a, b) => outlineArea(a) - outlineArea(b));
}

function BoundaryDialog({ site, onClose, onSave }: { site: SiteArea; onClose: () => void; onSave: (outline: Ring) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mode, setMode] = useState<Mode>("pick");
  const [outline, setOutline] = useState<Ring>(site.outline);
  const [drawing, setDrawing] = useState<Ring>([]);
  const [note, setNote] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const titleId = useId();
  /* Clicking the same spot again steps out to the next bigger shape. */
  const lastPick = useRef<{ x: number; y: number; index: number } | null>(null);
  const live = useRef({ mode });
  useEffect(() => {
    live.current = { mode };
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* Build the map once. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [lib, style] = await Promise.all([import("maplibre-gl"), buildStyle(hasAerial ? "aerial" : "streets")]);
      if (cancelled || !box.current) return;
      lib.setWorkerUrl("/maplibre-gl-worker.mjs");
      const ref = parseGridRef(site.ref);
      const [lat, lng] = ref ? gridToLatLng(ref) : DEFAULT_CENTRE;
      const map = new lib.Map({ container: box.current, style, center: [lng, lat], zoom: 16.5, maxZoom: 19.5, attributionControl: { compact: true } });
      mapRef.current = map;
      map.doubleClickZoom.disable();
      map.addControl(new lib.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("load", () => {
        const before = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
        for (const key of ["green", "water", "roads", "buildings", "paths"] as LineKey[]) for (const layer of lineLayers(key)) map.addLayer(layer, before);
        /* Near-invisible fills, so a click can find land use, parks and buildings. */
        for (const layer of PICKABLE_LAYERS) {
          map.addLayer({ id: `pick-${layer}`, type: "fill", source: "openmaptiles", "source-layer": layer, paint: { "fill-color": "#000", "fill-opacity": 0.01 } }, before);
        }
        map.addSource("draft", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "draft-fill", type: "fill", source: "draft", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#ff8c88", "fill-opacity": 0.18 } });
        map.addLayer({ id: "draft-casing", type: "line", source: "draft", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": "#ffffff", "line-width": 5 } });
        map.addLayer({ id: "draft-line", type: "line", source: "draft", filter: ["!=", ["geometry-type"], "Point"], paint: { "line-color": "#e5484d", "line-width": 2.4, "line-dasharray": [2, 1.4] } });
        map.addLayer({
          id: "draft-points",
          type: "circle",
          source: "draft",
          filter: ["==", ["geometry-type"], "Point"],
          paint: { "circle-radius": 4.5, "circle-color": "#ffffff", "circle-stroke-color": "#e5484d", "circle-stroke-width": 2 },
        });
        const box0 = outlineBounds(site.outline);
        if (box0) map.fitBounds([[box0.west, box0.south], [box0.east, box0.north]], { padding: 60, duration: 0, maxZoom: 18 });
        setReady(true);
      });

      map.on("click", (event) => {
        const at: [number, number] = [event.lngLat.lng, event.lngLat.lat];
        if (live.current.mode === "draw") {
          setDrawing((points) => [...points, at]);
          return;
        }
        const shapes = shapesAt(
          map.queryRenderedFeatures(event.point, { layers: [...PICKABLE_LAYERS.map((l) => `pick-${l}`), "op-lines-green-park", "op-lines-water-area"] }),
          at,
        );
        if (!shapes.length) {
          setNote("Nothing to pick there. Try clicking inside a field, plot or building, or draw the boundary by hand.");
          return;
        }
        const last = lastPick.current;
        const again = last && Math.hypot(last.x - event.point.x, last.y - event.point.y) < 8;
        const index = again ? (last.index + 1) % shapes.length : 0;
        lastPick.current = { x: event.point.x, y: event.point.y, index };
        setOutline(shapes[index]);
        setNote(
          shapes.length > 1
            ? `Picked shape ${index + 1} of ${shapes.length} here. Click the same spot again for the next bigger one.`
            : "Picked. If it is cut off, draw the boundary by hand instead.",
        );
      });
      /* A double-click closes the shape (its two clicks have added the same point twice). */
      map.on("dblclick", () => {
        if (live.current.mode !== "draw") return;
        setDrawing((points) => {
          const clean = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-7);
          if (clean.length < 3) return clean;
          setOutline(clean);
          return [];
        });
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Built once; the site's starting values are read on open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Show the outline (or the one being drawn). */
  useEffect(() => {
    const source = mapRef.current?.getSource("draft") as GeoJSONSource | undefined;
    if (!ready || !source) return;
    const shape = drawing.length ? drawing : outline;
    const closed = !drawing.length && shape.length >= 3;
    source.setData({
      type: "FeatureCollection",
      features: [
        ...(shape.length >= 2
          ? [
              closed
                ? { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [[...shape, shape[0]]] } }
                : { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: shape } },
            ]
          : []),
        ...(drawing.length || shape.length < 60
          ? shape.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: p } }))
          : []),
      ],
    });
  }, [outline, drawing, ready]);

  const area = outlineArea(drawing.length >= 3 ? drawing : outline);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-3 backdrop-blur-[2px] md:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="flex h-full max-h-[52rem] w-full max-w-[84rem] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row">
        <div className="relative min-h-[18rem] flex-1 bg-paper">
          <div ref={box} style={{ position: "absolute", inset: 0 }} className={mode === "draw" ? "[&_canvas]:cursor-crosshair" : "[&_canvas]:cursor-pointer"} />
          {!ready && <p className="absolute inset-0 grid place-items-center text-[0.75rem] text-ink/50">Loading map</p>}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-ink/10 p-4 md:w-80 md:border-l md:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-[1.05rem] font-medium text-ink">
                Mark the site boundary
              </h2>
              <p className="mt-1 text-[0.76rem] leading-snug text-ink/60">
                {parseGridRef(site.ref) ? "The map opens at the site's grid reference." : "Tip: type the site's grid reference first so the map opens there."}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-ink/50 hover:bg-ink/5 hover:text-ink">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div role="radiogroup" aria-label="How to mark it" className="flex rounded-sw border border-ink/15 bg-paper/60 p-0.5">
            {(
              [
                ["pick", "Pick from the map", MousePointerClick],
                ["draw", "Draw by hand", PenLine],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={mode === key}
                onClick={() => {
                  setMode(key);
                  setDrawing([]);
                  setNote(null);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[3px] px-2 py-1.5 text-[0.74rem] transition-colors focus-visible:outline-2 focus-visible:outline-ink",
                  mode === key ? "bg-ink text-white" : "text-ink/65 hover:text-ink",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          <p className="text-[0.76rem] leading-snug text-ink/65">
            {mode === "pick"
              ? "Click inside the site: a field, plot, park or building. Its outline comes from the map data."
              : "Click each corner of the site in turn. Double-click, or press Finish, to close the shape."}
          </p>

          {mode === "draw" && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!drawing.length}
                onClick={() => setDrawing((points) => points.slice(0, -1))}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sw border border-ink/15 text-[0.76rem] text-ink hover:bg-ink/5 disabled:opacity-40"
              >
                <Undo2 className="size-3.5" aria-hidden="true" />
                Undo point
              </button>
              <button
                type="button"
                disabled={drawing.length < 3}
                onClick={() => {
                  setOutline(drawing);
                  setDrawing([]);
                }}
                className="h-8 flex-1 rounded-sw bg-ink text-[0.76rem] font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                Finish ({drawing.length} points)
              </button>
            </div>
          )}

          {note && <p className="rounded-sw bg-paper px-2.5 py-2 text-[0.74rem] leading-snug text-ink/70">{note}</p>}

          <p className="text-[0.74rem] text-ink/60">
            {outline.length >= 3 || drawing.length >= 3 ? `About ${describeArea(area)}.` : "No boundary yet."}
          </p>

          <div className="mt-auto flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-9 flex-1 rounded-sw border border-ink/15 text-[0.82rem] text-ink hover:bg-ink/5">
              Cancel
            </button>
            <button
              type="button"
              disabled={outline.length < 3}
              onClick={() => onSave(outline)}
              className="h-9 flex-1 rounded-sw bg-ink text-[0.82rem] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Use this boundary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
