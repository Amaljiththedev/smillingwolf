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

/** Raw exports written by WordPress. */
export type ExportType = "responses" | "comments" | "reactions";
export const EXPORT_TYPES: readonly ExportType[] = ["responses", "comments", "reactions"];

/** Summary exports built here from the dashboard figures. */
export type SummaryType = "summary" | "themes" | "respondents" | "timeline";
export const SUMMARY_TYPES: readonly SummaryType[] = ["summary", "themes", "respondents", "timeline"];

export type DownloadType = ExportType | SummaryType;

/** Every CSV on offer, in the order the menus list them. */
export const DOWNLOADS: readonly { type: DownloadType; label: string; note: string }[] = [
  { type: "responses", label: "Questionnaire answers", note: "Every response, one row each" },
  { type: "summary", label: "Question results", note: "Counts and percentages for each answer" },
  { type: "comments", label: "Comments", note: "Every comment with its theme and status" },
  { type: "themes", label: "Themes and quotes", note: "Mentions per theme with what people said" },
  { type: "reactions", label: "Quick reactions", note: "Like, unsure and dislike for each idea" },
  { type: "respondents", label: "Who responded", note: "Age, connection to the area and postcode" },
  { type: "timeline", label: "Responses per day", note: "For your own charts" },
];

/** Rows for a summary export. The first row is the header. */
export function summaryRows(type: SummaryType, data: DashboardData): (string | number)[][] {
  switch (type) {
    case "summary": {
      const rows: (string | number)[][] = [["Code", "Question", "Answer", "People", "Share (%)", "Answered"]];
      for (const q of data.questionnaire) {
        if (q.type === "text") rows.push([q.code, q.text, "Written answers", q.notes, "", q.notes]);
        else for (const c of q.choices) rows.push([q.code, q.text, c.label, c.count, c.pct, q.total]);
      }
      return rows;
    }
    case "themes": {
      const rows: (string | number)[][] = [["Theme", "Mentions", "What people said", "People saying it"]];
      for (const t of data.quotes.length ? data.quotes : data.themes.map((t) => ({ ...t, quotes: [] }))) {
        if (!t.quotes.length) rows.push([t.label, t.count, "", ""]);
        for (const q of t.quotes) rows.push([t.label, t.count, q.text, q.count]);
      }
      return rows;
    }
    case "respondents": {
      const rows: (string | number)[][] = [["Group", "Answer", "People"]];
      const groups = [
        ["Age", data.respondents.age_band],
        ["Connection to the area", data.respondents.connection],
        ["Postcode", data.respondents.postcode],
      ] as const;
      for (const [label, list] of groups) for (const g of list) rows.push([label, g.label, g.count]);
      return rows;
    }
    case "timeline":
      return [["Day", "Responses"], ...data.timeline.map((p) => [p.date, p.count])];
  }
}

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
