import type {
  LayerSpecification,
  RasterDEMSourceSpecification,
  StyleSpecification,
} from "@maplibre/maplibre-gl-style-spec";

/*
  Base maps for the live map:

  - Streets: OpenFreeMap "Positron" (clean, light OpenStreetMap map), no key
  - Terrain: OpenFreeMap "Liberty" with hill shading from AWS Terrain Tiles, no key
  - Aerial: a soft, washed-out aerial photo with street names on top, the look
    architects use behind their masterplans. Aerial photos need an account
    with a provider (Esri, MapTiler and others), so this only appears once
    its tile address is set:
      NEXT_PUBLIC_AERIAL_TILES        tile address with {z}, {x} and {y}, key included
      NEXT_PUBLIC_AERIAL_TILE_SIZE    256 (default) or 512
      NEXT_PUBLIC_AERIAL_ATTRIBUTION  the credit line the provider requires

  3D (either base map) adds real ground height from the same elevation tiles
  and extrudes buildings from OpenStreetMap heights.
*/

export type Basemap = "streets" | "terrain" | "aerial";

const AERIAL_TILES = process.env.NEXT_PUBLIC_AERIAL_TILES ?? "";
/** True when an aerial photo provider is set up. */
export const hasAerial = /\{z\}/.test(AERIAL_TILES) && /^https:\/\//.test(AERIAL_TILES);

export const BASEMAPS: { key: Basemap; label: string }[] = [
  { key: "streets", label: "Streets" },
  { key: "terrain", label: "Terrain" },
  ...(hasAerial ? [{ key: "aerial" as const, label: "Aerial" }] : []),
];

/* A page saved with "aerial" falls back to streets where no provider is set up. */
export function isBasemap(value: unknown): value is Basemap {
  return value === "streets" || value === "terrain" || (value === "aerial" && hasAerial);
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
  if (basemap === "streets" || (basemap === "aerial" && !hasAerial)) return load("positron");
  if (basemap === "aerial") return aerialStyle();

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

/*
  The milky aerial: the photo faded, greyed a little and laid over white, so
  the masterplan drawn on top stands out, as on the architects' boards.
  Street and place names come from the streets map.
*/
async function aerialStyle(): Promise<StyleSpecification> {
  const positron = await load("positron");
  const size = Number(process.env.NEXT_PUBLIC_AERIAL_TILE_SIZE) === 512 ? 512 : 256;
  const labels = positron.layers.filter((layer) => layer.type === "symbol");
  return {
    ...positron,
    sources: {
      ...positron.sources,
      "op-aerial": {
        type: "raster",
        tiles: [AERIAL_TILES],
        tileSize: size,
        maxzoom: 19,
        attribution: process.env.NEXT_PUBLIC_AERIAL_ATTRIBUTION || "Aerial imagery",
      },
    },
    layers: [
      { id: "op-aerial-wash", type: "background", paint: { "background-color": "#ffffff" } },
      {
        id: "op-aerial",
        type: "raster",
        source: "op-aerial",
        paint: {
          "raster-opacity": 0.5,
          "raster-saturation": -0.5,
          "raster-contrast": -0.12,
          "raster-brightness-min": 0.2,
          "raster-fade-duration": 150,
        },
      },
      ...labels,
    ],
  };
}
