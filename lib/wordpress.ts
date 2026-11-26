import {
  cleanRange,
  type Comment,
  type DashboardData,
  type ExportType,
  type Range,
} from "@/lib/consultation";
import marketHill from "@/lib/demo/market-hill.json";

/*
  Server-side client for the WordPress back end.

  The browser never talks to WordPress. This app's server calls the plugin's
  REST API with a WordPress application password kept in the environment, so
  clients log in once (here) and never see a WordPress account.

    WP_API_URL           e.g. http://localhost or https://consultation.smilingwolf.co.uk
    WP_API_USER          the WordPress user the app password belongs to
    WP_API_APP_PASSWORD  Users > Profile > Application passwords

  Only import this from server components, server actions and route handlers.

  Demo mode: when WP_API_URL is not set at all (for example the hosted
  preview on Vercel), results come from a saved copy of the example scheme in
  lib/demo instead, so the dashboard, moderation, report and downloads still
  work. Moderation changes then last only while the server instance is warm,
  and uploads are switched off.
*/

type Snapshot = {
  savedAt: string;
  dashboard: DashboardData;
  comments: Comment[];
  exports: Record<ExportType, { filename: string; rows: (string | number)[][] }>;
};

const SNAPSHOTS: Record<string, Snapshot> = { "market-hill": marketHill as unknown as Snapshot };

export function isDemo(): boolean {
  return !process.env.WP_API_URL;
}

/** A line for the screens to show when the data is the saved demo copy. */
export function demoNote(): string | null {
  return isDemo()
    ? "Demo copy of the example results. Moderation changes are not kept, and date filters only change the timeline."
    : null;
}

function snapshot(site: string): Snapshot {
  const saved = SNAPSHOTS[sitePath(site)];
  if (!saved) throw new WordPressError("This scheme has no demo results.", 404);
  return saved;
}

/* Moderation changes made in demo mode, kept in memory for this server instance. */
const demoComments = new Map<string, Comment[]>();
function demoCommentList(site: string): Comment[] {
  if (!demoComments.has(site)) demoComments.set(site, structuredClone(snapshot(site).comments));
  return demoComments.get(site)!;
}

export class WordPressError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function config() {
  const url = process.env.WP_API_URL;
  const user = process.env.WP_API_USER;
  const password = process.env.WP_API_APP_PASSWORD;
  if (!url || !user || !password) {
    throw new WordPressError(
      "The WordPress connection is not set up. Add WP_API_URL, WP_API_USER and WP_API_APP_PASSWORD to .env.local.",
      500,
    );
  }
  return { url: url.replace(/\/+$/, ""), auth: "Basic " + btoa(`${user}:${password}`) };
}

/** Scheme sites are multisite paths ("market-hill"). Anything else is refused. */
function sitePath(site: string): string {
  if (!/^[a-z0-9-]+$/.test(site)) throw new WordPressError("Unknown scheme.", 400);
  return site;
}

async function call<T>(site: string, path: string, init: RequestInit = {}, query?: Range): Promise<T> {
  const { url, auth } = config();
  const q = new URLSearchParams();
  const range = cleanRange(query ?? {});
  if (range.from) q.set("from", range.from);
  if (range.to) q.set("to", range.to);
  const qs = q.toString();

  let response: Response;
  try {
    response = await fetch(`${url}/${sitePath(site)}/wp-json/swc/v1${path}${qs ? `?${qs}` : ""}`, {
      ...init,
      cache: "no-store",
      headers: { Authorization: auth, Accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    throw new WordPressError("Could not reach WordPress. Check that it is running and WP_API_URL is right.", 502);
  }

  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? "WordPress refused the app password. Check WP_API_USER and WP_API_APP_PASSWORD."
        : `WordPress answered ${response.status}.`;
    throw new WordPressError(message, response.status);
  }
  return (await response.json()) as T;
}

export async function getDashboard(site: string, range: Range = {}): Promise<DashboardData> {
  if (isDemo()) {
    const data = structuredClone(snapshot(site).dashboard);
    const { from, to } = cleanRange(range);
    data.timeline = data.timeline.filter((p) => (!from || p.date >= from) && (!to || p.date <= to));
    return data;
  }
  return call<DashboardData>(site, "/dashboard", {}, range);
}

export async function getComments(site: string, status: Comment["status"] | "all"): Promise<Comment[]> {
  if (isDemo()) return demoCommentList(site).filter((c) => status === "all" || c.status === status);
  return call<Comment[]>(site, `/comments?status=${status}`);
}

export function moderateComment(
  site: string,
  id: number,
  change: { status?: Comment["status"]; theme?: string },
): Promise<{ ok: true }> {
  if (isDemo()) {
    const comment = demoCommentList(site).find((c) => c.id === Math.trunc(id));
    if (!comment) throw new WordPressError("That comment no longer exists.", 404);
    if (change.status) comment.status = change.status;
    if (change.theme !== undefined) {
      comment.theme = change.theme;
      comment.themeLabel = snapshot(site).dashboard.themeLabels[change.theme] ?? "";
    }
    return Promise.resolve({ ok: true as const });
  }
  return call<{ ok: true }>(site, `/comments/${Math.trunc(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
}

export function getExport(
  site: string,
  type: ExportType,
  range: Range = {},
): Promise<{ filename: string; rows: (string | number)[][] }> {
  if (isDemo()) return Promise.resolve(structuredClone(snapshot(site).exports[type]));
  return call(site, `/export/${type}`, {}, range);
}

/* ---------- Media library ---------- */

export type UploadedMedia = { id: number; url: string; size: number; type: string };

/**
 * Puts a file in the WordPress media library of the scheme's site (or the
 * network's main site when the scheme has no WordPress site yet).
 * Checks on type and size happen in the route before this is called.
 */
export async function uploadMedia(site: string | undefined, file: { name: string; type: string; bytes: ArrayBuffer }): Promise<UploadedMedia> {
  if (isDemo()) {
    throw new WordPressError("Uploads are off in this demo copy. Use a link to the image or file instead.", 503);
  }
  const { url, auth } = config();
  const base = site ? `${url}/${sitePath(site)}` : url;

  let response: Response;
  try {
    response = await fetch(`${base}/wp-json/wp/v2/media`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: auth,
        Accept: "application/json",
        "Content-Type": file.type,
        "Content-Disposition": `attachment; filename="${file.name}"`,
      },
      body: file.bytes,
      /* WordPress builds thumbnails before it answers, so give it time, but not forever. */
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new WordPressError("WordPress did not answer. Try a smaller file, or check that WordPress is running.", 504);
  }

  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? "WordPress refused the upload. The app password's user needs permission to upload files."
        : `WordPress answered ${response.status}.`;
    throw new WordPressError(message, response.status);
  }

  const body = (await response.json()) as { id?: number; source_url?: string; mime_type?: string };
  if (typeof body.id !== "number" || typeof body.source_url !== "string") {
    throw new WordPressError("WordPress did not return the uploaded file.", 502);
  }
  return { id: body.id, url: body.source_url, size: file.bytes.byteLength, type: body.mime_type ?? file.type };
}
