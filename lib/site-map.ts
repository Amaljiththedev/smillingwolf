import type { FilterSpecification, LayerSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { Bounds } from "@/lib/geo";
import * as clipping from "polygon-clipping";
import { gridToLatLng, parseGridRef } from "@/lib/osgrid";

/*
  The scheme's site, set once on the map block and used everywhere the map is:
  - ref:     its OS grid reference (where the map opens),
  - outline: its boundary as [lng, lat] points, picked from the map data or
             drawn by hand,
  - lines:   which lines are drawn from OpenStreetMap over the base map
             (paths, roads, buildings, green space, water), in the clean
             illustrated style of the architects' boards.

  The lines come from the same vector tiles as the street map (OpenMapTiles
  schema, served by OpenFreeMap), so they work anywhere with no upload.
*/

export type LineKey = "paths" | "roads" | "buildings" | "green" | "water";

export const LINE_SETS: { key: LineKey; label: string }[] = [
  { key: "paths", label: "Paths and cycle routes" },
  { key: "roads", label: "Roads" },
  { key: "buildings", label: "Buildings" },
  { key: "green", label: "Parks and green space" },
  { key: "water", label: "Water" },
];

export type SiteArea = { ref: string; outline: [number, number][]; lines: LineKey[] };

/** Where new map blocks open until the site is set. */
export const DEFAULT_CENTRE: [number, number] = [53.4084, -2.1494];

export function blankSite(): SiteArea {
  return { ref: "", outline: [], lines: LINE_SETS.map((set) => set.key) };
}

export function readSite(value: unknown): SiteArea | null {
  if (typeof value !== "object" || value === null) return null;
  const site = value as Partial<SiteArea>;
  const outline = Array.isArray(site.outline)
    ? site.outline.filter(
        (p): p is [number, number] =>
          Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90,
      )
    : [];
  const keys = new Set(LINE_SETS.map((set) => set.key));
  const lines = Array.isArray(site.lines) ? site.lines.filter((key): key is LineKey => keys.has(key as LineKey)) : [];
  return { ref: typeof site.ref === "string" ? site.ref : "", outline: outline.length >= 3 ? outline : [], lines };
}

export function outlineBounds(outline: [number, number][]): Bounds | null {
  if (outline.length < 3) return null;
  const lngs = outline.map((p) => p[0]);
  const lats = outline.map((p) => p[1]);
  return { west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) };
}

/** [lat, lng] of the site: the middle of its boundary, else its grid reference. */
export function siteCentre(site: SiteArea | null): [number, number] | null {
  if (!site) return null;
  const box = outlineBounds(site.outline);
  if (box) return [(box.north + box.south) / 2, (box.east + box.west) / 2];
  const ref = parseGridRef(site.ref);
  return ref ? gridToLatLng(ref) : null;
}

/** Area of a boundary in square metres (fine at site scale). */
export function outlineArea(outline: [number, number][]): number {
  if (outline.length < 3) return 0;
  const lat0 = (outline.reduce((sum, p) => sum + p[1], 0) / outline.length) * (Math.PI / 180);
  const mx = 111_320 * Math.cos(lat0);
  const my = 110_540;
  let twice = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[(i + 1) % outline.length];
    twice += x1 * mx * (y2 * my) - x2 * mx * (y1 * my);
  }
  return Math.abs(twice) / 2;
}

export function describeArea(squareMetres: number): string {
  return squareMetres >= 10_000 ? `${(squareMetres / 10_000).toFixed(squareMetres >= 100_000 ? 0 : 1)} hectares` : `${Math.round(squareMetres / 10) * 10} square metres`;
}

/* ---------- Line styles ---------- */

const SOURCE = "openmaptiles";
const PATHS: FilterSpecification = ["all", ["==", ["get", "class"], "path"], ["!=", ["get", "subclass"], "cycleway"]];
const CYCLE: FilterSpecification = ["any", ["==", ["get", "subclass"], "cycleway"], ["==", ["get", "class"], "cycleway"]];
const ROADS: FilterSpecification = ["match", ["get", "class"], ["motorway", "trunk", "primary", "secondary", "tertiary", "minor", "service"], true, false];
const GREEN_LAND: FilterSpecification = ["match", ["get", "class"], ["grass", "wood", "farmland"], true, false];
const GREEN_USE: FilterSpecification = ["match", ["get", "class"], ["pitch", "playground", "cemetery", "garden", "allotments"], true, false];

const thin = (low: number, high: number) => ["interpolate", ["linear"], ["zoom"], 14, low, 19, high] as unknown as number;

/*
  Map layers for one set of lines, all with ids starting "op-lines-".
  Kept quiet on purpose: fine lines and faint tints that let the photo show
  through, like a site plan, not a cartoon.
*/
export function lineLayers(key: LineKey): LayerSpecification[] {
  const id = (part: string) => `op-lines-${key}-${part}`;
  switch (key) {
    case "green":
      return [
        { id: id("park"), type: "fill", source: SOURCE, "source-layer": "park", paint: { "fill-color": "#7fa35a", "fill-opacity": 0.14 } },
        { id: id("cover"), type: "fill", source: SOURCE, "source-layer": "landcover", filter: GREEN_LAND, paint: { "fill-color": "#7fa35a", "fill-opacity": 0.12 } },
        { id: id("use"), type: "fill", source: SOURCE, "source-layer": "landuse", filter: GREEN_USE, paint: { "fill-color": "#7fa35a", "fill-opacity": 0.12 } },
        { id: id("edge"), type: "line", source: SOURCE, "source-layer": "park", paint: { "line-color": "#6b8a4a", "line-width": thin(0.4, 0.9), "line-opacity": 0.5 } },
      ];
    case "water":
      return [
        { id: id("area"), type: "fill", source: SOURCE, "source-layer": "water", paint: { "fill-color": "#7aa7c7", "fill-opacity": 0.22 } },
        { id: id("way"), type: "line", source: SOURCE, "source-layer": "waterway", paint: { "line-color": "#6a96b8", "line-width": thin(0.6, 1.4), "line-opacity": 0.7 } },
      ];
    case "roads":
      return [
        {
          id: id("edge"),
          type: "line",
          source: SOURCE,
          "source-layer": "transportation",
          filter: ROADS,
          layout: { "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": thin(0.5, 1.2), "line-opacity": 0.75 },
        },
      ];
    case "buildings":
      return [
        { id: id("fill"), type: "fill", source: SOURCE, "source-layer": "building", minzoom: 14, paint: { "fill-color": "#ffffff", "fill-opacity": 0.28 } },
        {
          id: id("edge"),
          type: "line",
          source: SOURCE,
          "source-layer": "building",
          minzoom: 14,
          paint: { "line-color": "#4a4a46", "line-width": thin(0.25, 0.8), "line-opacity": 0.65 },
        },
      ];
    case "paths":
      return [
        {
          id: id("walk"),
          type: "line",
          source: SOURCE,
          "source-layer": "transportation",
          filter: PATHS,
          minzoom: 14,
          layout: { "line-join": "round" },
          paint: { "line-color": "#b4524c", "line-width": thin(0.6, 1.5), "line-opacity": 0.75, "line-dasharray": [3, 2] },
        },
        {
          id: id("cycle"),
          type: "line",
          source: SOURCE,
          "source-layer": "transportation",
          filter: CYCLE,
          minzoom: 14,
          layout: { "line-join": "round" },
          paint: { "line-color": "#4a6f9e", "line-width": thin(0.7, 1.6), "line-opacity": 0.75, "line-dasharray": [4, 2] },
        },
      ];
  }
}

/** Shapes a click can pick as the boundary: land use, parks, green areas, water and buildings. */
export const PICKABLE_LAYERS = ["landuse", "landcover", "park", "water", "building"] as const;

/** Demo comment pins spread inside a boundary, the same every time. */
export function pinsInside(outline: [number, number][], count: number): { id: string; lng: number; lat: number; tone: "pos" | "neg" | "" }[] {
  const box = outlineBounds(outline);
  if (!box || count <= 0) return [];
  const tones = ["neg", "pos", "", "neg", "pos", ""] as const;
  const pins: { id: string; lng: number; lat: number; tone: "pos" | "neg" | "" }[] = [];
  /* An even, scattered sequence over the box (golden-ratio steps), keeping points inside. */
  for (let i = 1; i < 600 && pins.length < count; i++) {
    const lng = box.west + (box.east - box.west) * (0.12 + 0.76 * ((i * 0.618034) % 1));
    const lat = box.south + (box.north - box.south) * (0.12 + 0.76 * ((i * 0.754878) % 1));
    if (!inRing([lng, lat], outline)) continue;
    const n = pins.length;
    pins.push({ id: `demo-${n}`, lng, lat, tone: tones[n % tones.length] });
  }
  return pins;
}

/* ---------- Finding the boundary in the map data ---------- */

/*
  The map data comes in square tiles, and an area that crosses a tile edge
  arrives as several pieces. Pieces of the same feature (same id, or the same
  layer and properties) that touch are joined back together before the
  outline is taken, so a site is never cut off with a straight tile edge.
*/

/* Its browser build has only a default export, while its types list named ones. */
const { union } = ((clipping as unknown as { default?: typeof clipping }).default ?? clipping) as typeof clipping;
type Pair = clipping.Pair;

type Ring = [number, number][];
type ShapeFeature = {
  id?: string | number;
  sourceLayer?: string;
  properties?: Record<string, unknown> | null;
  geometry: { type: string; coordinates?: unknown };
};
type Box = [number, number, number, number];

function inRing([x, y]: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonsOf(feature: ShapeFeature): Pair[][][] {
  const g = feature.geometry;
  return (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []) as Pair[][][];
}

function boxOf(polygon: Pair[][]): Box {
  const xs = polygon[0].map((p) => p[0]);
  const ys = polygon[0].map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const touches = (a: Box, b: Box, e = 1e-7) => a[0] <= b[2] + e && b[0] <= a[2] + e && a[1] <= b[3] + e && b[1] <= a[3] + e;

/** The outer rings of the areas under a point, joined across tile edges, smallest first. */
export function shapesAt(features: ShapeFeature[], at: [number, number]): Ring[] {
  /* Group the pieces of each feature. */
  const groups = new Map<string, Pair[][][]>();
  for (const feature of features) {
    const key = feature.id !== undefined && feature.id !== null ? `${feature.sourceLayer}#${feature.id}` : `${feature.sourceLayer}|${JSON.stringify(feature.properties ?? {})}`;
    const list = groups.get(key) ?? [];
    list.push(...polygonsOf(feature).filter((polygon) => polygon[0]?.length >= 4));
    groups.set(key, list);
  }

  const rings: Ring[] = [];
  const seen = new Set<string>();
  for (const pieces of groups.values()) {
    const hits = pieces.filter((polygon) => inRing(at, polygon[0]));
    if (!hits.length) continue;
    /* Grow from the piece under the point to the pieces touching it. */
    const cluster = new Set(hits);
    let box = hits.map(boxOf).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
    for (let round = 0; round < 12; round++) {
      let grew = false;
      for (const polygon of pieces) {
        if (cluster.has(polygon) || cluster.size >= 40) continue;
        const b = boxOf(polygon);
        if (!touches(box, b)) continue;
        cluster.add(polygon);
        box = [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])];
        grew = true;
      }
      if (!grew) break;
    }
    let joined: Pair[][][];
    try {
      const [first, ...rest] = [...cluster];
      joined = rest.length ? union(first, ...rest) : [first];
    } catch {
      joined = hits;
    }
    for (const polygon of joined) {
      if (!inRing(at, polygon[0])) continue;
      const ring = polygon[0].slice(0, -1).map((p) => [p[0], p[1]] as [number, number]);
      const sig = ring.map((p) => p.map((n) => n.toFixed(6)).join()).join("|");
      if (seen.has(sig)) continue;
      seen.add(sig);
      rings.push(ring);
    }
  }
  /* Whole districts are never a site. */
  return rings.filter((r) => outlineArea(r) < 3_000_000).sort((a, b) => outlineArea(a) - outlineArea(b));
}

type SourceMap = {
  getSource: (id: string) => unknown;
  querySourceFeatures: (source: string, options: { sourceLayer: string }) => ShapeFeature[];
};

function featuresIn(map: SourceMap, layers: readonly string[]): ShapeFeature[] {
  if (!map.getSource(SOURCE)) return [];
  return layers.flatMap((sourceLayer) => map.querySourceFeatures(SOURCE, { sourceLayer }).map((f) => ({ ...f, sourceLayer, geometry: f.geometry })));
}

/** Every area under a point (land use, parks, green areas, water, buildings), smallest first. */
export function areasAt(map: SourceMap, at: [number, number]): Ring[] {
  return shapesAt(featuresIn(map, PICKABLE_LAYERS), at);
}

/**
 * The site's likely boundary at a point: the smallest land-use area, park or
 * green area there that is at least the size of a small plot. Buildings are
 * left out, since a grid reference often lands on one inside the site.
 */
export function findSiteShape(map: SourceMap, at: [number, number]): Ring | null {
  return shapesAt(featuresIn(map, ["landuse", "park", "landcover"]), at).find((ring) => outlineArea(ring) >= 800) ?? null;
}
