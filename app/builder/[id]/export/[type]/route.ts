import { getSession } from "@/lib/auth";
import {
  EXPORT_TYPES,
  SUMMARY_TYPES,
  cleanRange,
  summaryRows,
  type ExportType,
  type SummaryType,
} from "@/lib/consultation";
import { getSite } from "@/lib/sites";
import { WordPressError, getDashboard, getExport } from "@/lib/wordpress";

/*
  CSV downloads: /builder/{site}/export/{type}?from=&to=

  responses, comments, reactions: WordPress returns the raw rows.
  summary, themes, respondents, timeline: built here from the dashboard figures.

  Files are written the same way the plugin's own export writes them
  (UTF-8 with a BOM for Excel, formulas defused).
*/

/** Spreadsheet apps run cells starting with these as formulas; prefix them so they stay text. */
function cell(value: string | number): string {
  if (typeof value === "number") return String(value);
  let text = value;
  if (text !== "" && Number.isNaN(Number(text)) && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
  if (!(await getSession())) return new Response("Log in to download results.", { status: 401 });

  const { id, type } = await params;
  const site = getSite(id);
  if (!site?.wordpress) return new Response("This site has no results yet.", { status: 404 });

  const raw = EXPORT_TYPES.includes(type as ExportType);
  const summary = SUMMARY_TYPES.includes(type as SummaryType);
  if (!raw && !summary) return new Response("Unknown export.", { status: 404 });

  const search = new URL(request.url).searchParams;
  const range = cleanRange({ from: search.get("from") ?? undefined, to: search.get("to") ?? undefined });

  try {
    let filename: string;
    let rows: (string | number)[][];
    if (raw) {
      ({ filename, rows } = await getExport(site.wordpress, type as ExportType, range));
    } else {
      const data = await getDashboard(site.wordpress, range);
      rows = summaryRows(type as SummaryType, data);
      /* Named like the WordPress exports: scheme name, then what it is. */
      const scheme = data.site.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || site.id;
      const dates = range.from || range.to ? `-${range.from ?? "start"}-to-${range.to ?? "today"}` : "";
      filename = `${scheme}-${type}${dates}.csv`;
    }
    const csv = "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
    const safeName = filename.replace(/[^a-z0-9._-]/gi, "-");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = error instanceof WordPressError ? error.status : 500;
    return new Response(error instanceof Error ? error.message : "Export failed.", { status });
  }
}
