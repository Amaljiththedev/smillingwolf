import type { FilterSpecification, LayerSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { Bounds } from "@/lib/geo";
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

const roadWidth = (base: number) =>
  ["interpolate", ["exponential", 1.6], ["zoom"], 13, base * 0.4, 16, base * 1.6, 19, base * 6] as unknown as number;

/** Map layers for one set of lines, all with ids starting "op-lines-". */
export function lineLayers(key: LineKey): LayerSpecification[] {
  const id = (part: string) => `op-lines-${key}-${part}`;
  switch (key) {
    case "green":
      return [
        { id: id("park"), type: "fill", source: SOURCE, "source-layer": "park", paint: { "fill-color": "#b5d98a", "fill-opacity": 0.55, "fill-outline-color": "#6f9d3c" } },
        { id: id("cover"), type: "fill", source: SOURCE, "source-layer": "landcover", filter: GREEN_LAND, paint: { "fill-color": "#b5d98a", "fill-opacity": 0.5, "fill-outline-color": "#6f9d3c" } },
        { id: id("use"), type: "fill", source: SOURCE, "source-layer": "landuse", filter: GREEN_USE, paint: { "fill-color": "#c4e29c", "fill-opacity": 0.55, "fill-outline-color": "#6f9d3c" } },
      ];
    case "water":
      return [
        { id: id("area"), type: "fill", source: SOURCE, "source-layer": "water", paint: { "fill-color": "#9fcdef", "fill-opacity": 0.8, "fill-outline-color": "#5f9fd3" } },
        { id: id("way"), type: "line", source: SOURCE, "source-layer": "waterway", paint: { "line-color": "#6fa9dc", "line-width": 2 } },
      ];
    case "roads":
      return [
        {
          id: id("casing"),
          type: "line",
          source: SOURCE,
          "source-layer": "transportation",
          filter: ROADS,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#8d8a84", "line-width": roadWidth(1.4), "line-opacity": 0.9 },
        },
        {
          id: id("fill"),
          type: "line",
          source: SOURCE,
          "source-layer": "transportation",
          filter: ROADS,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": roadWidth(1), "line-opacity": 0.95 },
        },
      ];
    case "buildings":
      return [
        {
          id: id("fill"),
          type: "fill",
          source: SOURCE,
          "source-layer": "building",
          minzoom: 14,
          paint: { "fill-color": "#f4ebdd", "fill-opacity": 0.9 },
        },
        {
          id: id("edge"),
          type: "line",
          source: SOURCE,
          "source-layer": "building",
          minzoom: 14,
          paint: { "line-color": "#3c3a35", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.3, 18, 1.2] as unknown as number },
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
          minzoom: 13,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#f2675f", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 18, 3] as unknown as number, "line-dasharray": [1.6, 1.2] },
        },
        {
          id: id("cycle"),
          type: "line",
          source: SOURCE,
          "source-layer": "transportation",
          filter: CYCLE,
          minzoom: 13,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#3f7fe0", "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1.2, 18, 3.4] as unknown as number, "line-dasharray": [2.4, 1.2] },
        },
      ];
  }
}

/** Shapes a click can pick as the boundary: land use, parks, green areas, water and buildings. */
export const PICKABLE_LAYERS = ["landuse", "landcover", "park", "water", "building"] as const;
