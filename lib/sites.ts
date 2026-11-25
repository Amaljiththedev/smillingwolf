/*
  The site model the builder edits.
  In-memory for now; these types are the shape the database tables will take,
  so moving to Postgres later is a storage swap rather than a rewrite.
*/

export type BlockKind = "header" | "hero" | "text" | "map" | "survey" | "timeline" | "footer";

export type Block = {
  id: string;
  kind: BlockKind;
  /** Per-block content. Shape depends on kind; the editor panel reads it. */
  props: Record<string, unknown>;
};

export type Brand = {
  /** Hex, from the palette in the design bible. */
  accent: string;
  logoText: string;
};

export type Site = {
  id: string;
  name: string;
  /** Subdomain or custom domain the consultation is served on. */
  domain: string;
  status: "draft" | "live";
  brand: Brand;
  blocks: Block[];
  updatedAt: string;
};

/* Example data, so the dashboard and editor have something to show.
   The site and every figure in it are fictional. */
export const DEMO_SITES: Site[] = [
  {
    id: "millbrook-yards",
    name: "Millbrook Yards",
    domain: "haveyoursay.millbrookyards.co.uk",
    status: "live",
    brand: { accent: "#c2c698", logoText: "Millbrook Yards" },
    blocks: [
      { id: "b1", kind: "header", props: { title: "Millbrook Yards" } },
      { id: "b2", kind: "map", props: { title: "The masterplan" } },
      { id: "b3", kind: "survey", props: { question: "How would you travel to the new park?" } },
    ],
    updatedAt: "2026-11-24",
  },
  {
    id: "station-quarter",
    name: "Station Quarter",
    domain: "stationquarter.example.gov.uk",
    status: "draft",
    brand: { accent: "#bfe9ff", logoText: "Station Quarter" },
    blocks: [{ id: "b1", kind: "header", props: { title: "Station Quarter" } }],
    updatedAt: "2026-11-21",
  },
];

export function getSite(id: string): Site | undefined {
  return DEMO_SITES.find((site) => site.id === id);
}
