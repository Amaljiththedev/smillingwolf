"use server";

import { getSession } from "@/lib/auth";
import type { Comment, DashboardData, Range } from "@/lib/consultation";
import { getSite } from "@/lib/sites";
import { WordPressError, getComments, getDashboard, moderateComment } from "@/lib/wordpress";

/*
  Server actions the dashboard screens call from the browser. Every one checks
  the session and looks the scheme up by its builder id, so the browser can
  never point a request at another WordPress site.
*/

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function schemeFor(siteId: string): Promise<string> {
  if (!(await getSession())) throw new WordPressError("Your session has ended. Log in again.", 401);
  const site = getSite(siteId);
  if (!site?.wordpress) throw new WordPressError("This site has no results yet.", 404);
  return site.wordpress;
}

async function attempt<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof WordPressError ? error.message : "Something went wrong loading the results.",
    };
  }
}

export async function loadDashboard(siteId: string, range: Range): Promise<Result<DashboardData>> {
  return attempt(async () => getDashboard(await schemeFor(siteId), range));
}

export async function loadComments(
  siteId: string,
  status: Comment["status"],
): Promise<Result<Comment[]>> {
  return attempt(async () => getComments(await schemeFor(siteId), status));
}

const STATUSES = new Set<Comment["status"]>(["approved", "pending", "rejected"]);

export async function updateComment(
  siteId: string,
  id: number,
  change: { status?: Comment["status"]; theme?: string },
): Promise<Result<true>> {
  return attempt(async () => {
    const scheme = await schemeFor(siteId);
    const clean: { status?: Comment["status"]; theme?: string } = {};
    if (change.status && STATUSES.has(change.status)) clean.status = change.status;
    if (typeof change.theme === "string" && /^[a-z0-9_]*$/.test(change.theme)) clean.theme = change.theme;
    if (!Number.isInteger(id) || id <= 0 || Object.keys(clean).length === 0) {
      throw new WordPressError("Nothing to change.", 400);
    }
    await moderateComment(scheme, id, clean);
    return true as const;
  });
}
