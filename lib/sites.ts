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
      {
        id: "mb-header",
        kind: "header",
        props: {
          title: "Millbrook Yards",
          links: ["Overview", "The masterplan", "Have your say"],
          animation: "fade",
        },
      },
      {
        id: "mb-hero",
        kind: "hero",
        props: {
          eyebrow: "Public consultation",
          title: "Have your say on Millbrook Yards",
          body: "We are proposing new homes, workspace and a riverside park on the former yards. Tell us what you think before the consultation closes.",
          cta: "Take the survey",
          animation: "rise",
        },
      },
      {
        id: "mb-map",
        kind: "map",
        props: {
          title: "The masterplan",
          caption: "Drop a pin to comment on a specific spot.",
          pins: "4",
          animation: "scale",
        },
      },
      {
        id: "mb-survey",
        kind: "survey",
        props: {
          question: "How would you travel to the new park?",
          answers: ["Walk", "Cycle", "Bus", "Car"],
          animation: "rise",
        },
      },
      {
        id: "mb-footer",
        kind: "footer",
        props: {
          contact: "consultation@millbrookyards.co.uk",
          note: "This consultation closes on 31 March.",
          animation: "fade",
        },
      },
    ],
    updatedAt: "2026-11-24",
  },
  {
    id: "station-quarter",
    name: "Station Quarter",
    domain: "stationquarter.example.gov.uk",
    status: "draft",
    brand: { accent: "#bfe9ff", logoText: "Station Quarter" },
    blocks: [
      {
        id: "sq-header",
        kind: "header",
        props: {
          title: "Station Quarter",
          links: ["Overview", "Have your say"],
          animation: "fade",
        },
      },
      {
        id: "sq-text",
        kind: "text",
        props: {
          title: "About the proposals",
          body: "Early thinking for the land around the station. This page is a draft and is not published yet.",
          animation: "rise",
        },
      },
    ],
    updatedAt: "2026-11-21",
  },
];

export function getSite(id: string): Site | undefined {
  return DEMO_SITES.find((site) => site.id === id);
}
