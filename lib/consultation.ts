/*
  Shapes of the data the WordPress plugin (sw-consultation) returns from
  /wp-json/swc/v1/. WordPress stays the back end: Gravity Forms answers,
  reactions and map comments live there, and this app only reads and moderates.
*/

export type Summary = {
  responses: number;
  /** Share supporting the scheme overall; null when the questionnaire has no such question. */
  support_pct: number | null;
  reactions: number;
  comments: number;
  pending_comments: number;
  written: number;
  /** News and updates sign-ups; null when the scheme has no sign-up form. */
  signups: number | null;
};

export type ScaleKey = "strongly_oppose" | "oppose" | "neutral" | "support" | "strongly_support";

export type Proposal = {
  key: string;
  label: string;
  counts: Record<ScaleKey, number>;
  total: number;
  net: number;
};

export type Theme = { key: string; label: string; count: number };
export type Group = { key?: string; label: string; count: number };

export type Reaction = { key: string; label: string; like: number; unsure: number; dislike: number };

export type Choice = { key: string; label: string; count: number; pct: number };

export type Question = {
  key: string;
  code: string;
  text: string;
  hint: string;
  demographic: string;
  /** "choice" questions have counted answers; "text" questions have written ones. */
  type: "choice" | "text";
  kind: "choice" | "ranking" | "multi" | "text";
  total: number;
  choices: Choice[];
  note?: string;
  /** Written comments added alongside this question. */
  notes: number;
  latest: { text: string; theme: string }[];
};

export type Comment = {
  id: number;
  /** Street map: latitude. Masterplan: % from the top of the plan. */
  lat: number;
  /** Street map: longitude. Masterplan: % from the left of the plan. */
  lng: number;
  place: "map" | "plan";
  topic: string;
  theme: string;
  themeLabel: string;
  sentiment: "pos" | "neg" | "";
  body: string;
  status: "approved" | "pending" | "rejected";
  date: string;
};

export type PlanLayer = { label: string; colour: string; url: string; on: boolean; icon: string; details: string };

export type Plan = {
  title: string;
  intro: string;
  base: string;
  width: number;
  height: number;
  layers: PlanLayer[];
  points?: { title: string; text: string; x: number; y: number }[];
};

export type QuoteTheme = { key: string; label: string; count: number; quotes: { text: string; count: number }[] };

export type DashboardData = {
  summary: Summary;
  timeline: { date: string; count: number }[];
  support: { scale: Record<ScaleKey, string>; proposals: Proposal[] };
  themes: Theme[];
  respondents: { age_band: Group[]; connection: Group[]; postcode: Group[] };
  reactions: Reaction[];
  questionnaire: Question[];
  comments: Comment[];
  themeLabels: Record<string, string>;
  site: { name: string; place: "map" | "plan"; centre: [number, number] };
  plan: Plan | null;
  quotes: QuoteTheme[];
};

export type ExportType = "responses" | "comments" | "reactions";
export const EXPORT_TYPES: readonly ExportType[] = ["responses", "comments", "reactions"];

export type Range = { from?: string; to?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Keeps only well-formed Y-m-d dates, so nothing else reaches the WordPress query string. */
export function cleanRange(range: Range): Range {
  return {
    from: range.from && DAY.test(range.from) ? range.from : undefined,
    to: range.to && DAY.test(range.to) ? range.to : undefined,
  };
}

/* Brand colours for charts. Diverging scale runs coral (against) to ink (for). */
export const SCALE_COLOURS: Record<ScaleKey, string> = {
  strongly_oppose: "#ff8c88",
  oppose: "#ffd2bf",
  neutral: "#e7e2dd",
  support: "#c2c698",
  strongly_support: "#131713",
};

export const REACTION_COLOURS = { like: "#c2c698", unsure: "#e7e2dd", dislike: "#ff8c88" } as const;
