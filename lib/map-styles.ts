import type {
  LayerSpecification,
  RasterDEMSourceSpecification,
  StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";

/*
  Base maps for the live map, both open data with no API key:

  - Streets: OpenFreeMap "Positron" (clean, light OpenStreetMap map)
  - Terrain: OpenFreeMap "Liberty" with hill shading from AWS Terrain Tiles

  3D (either base map) adds real ground height from the same elevation tiles
  and extrudes buildings from OpenStreetMap heights.
*/

export type Basemap = "streets" | "terrain";

export const BASEMAPS: { key: Basemap; label: string }[] = [
  { key: "streets", label: "Streets" },
  { key: "terrain", label: "Terrain" },
];

export function isBasemap(value: unknown): value is Basemap {
  return value === "streets" || value === "terrain";
}

export const DEM: RasterDEMSourceSpecification = {
  type: "raster-dem",
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  tileSize: 256,
  encoding: "terrarium",
  maxzoom: 15,
  attribution: "Elevation: AWS Terrain Tiles (Mapzen)",
};

const cache = new Map<string, Promise<StyleSpecification>>();
function load(name: "positron" | "liberty"): Promise<StyleSpecification> {
  let job = cache.get(name);
  if (!job) {
    job = fetch(`https://tiles.openfreemap.org/styles/${name}`).then((r) => {
      if (!r.ok) throw new Error(`Map style ${name} failed (${r.status})`);
      return r.json() as Promise<StyleSpecification>;
    });
    cache.set(name, job);
    job.catch(() => cache.delete(name));
  }
  return job.then((style) => structuredClone(style));
}

export async function buildStyle(basemap: Basemap): Promise<StyleSpecification> {
  if (basemap === "streets") return load("positron");

  /* Terrain: hill shading slipped in under the place names. */
  const liberty = await load("liberty");
  const firstLabel = liberty.layers.findIndex((l) => l.type === "symbol");
  const hillshade: LayerSpecification = {
    id: "op-hillshade",
    type: "hillshade",
    source: "op-dem-shade",
    paint: {
      "hillshade-exaggeration": 0.45,
      "hillshade-shadow-color": "#4a4336",
      "hillshade-highlight-color": "#ffffff",
      "hillshade-accent-color": "#6b6250",
    },
  };
  liberty.layers.splice(firstLabel === -1 ? liberty.layers.length : firstLabel, 0, hillshade);
  liberty.sources["op-dem-shade"] = DEM;
  return liberty;
}
