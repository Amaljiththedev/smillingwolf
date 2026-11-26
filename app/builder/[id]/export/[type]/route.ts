import { getSession } from "@/lib/auth";
import { EXPORT_TYPES, cleanRange, type ExportType } from "@/lib/consultation";
import { getSite } from "@/lib/sites";
import { WordPressError, getExport } from "@/lib/wordpress";

/*
  CSV downloads: /builder/{site}/export/{responses|comments|reactions}?from=&to=
  WordPress returns the rows; the file is written here, the same way the
  plugin's own export writes it (UTF-8 with a BOM for Excel, formulas defused).
*/

/** Spreadsheet apps run cells starting with these as formulas; prefix them so they stay text. */
function cell(value: string | number): string {
  if (typeof value === "number") return String(value);
  let text = value;
  if (text !== "" && Number.isNaN(Number(text)) && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  if (!(await getSession())) return new Response("Log in to download results.", { status: 401 });

  const { id, type } = await params;
  const site = getSite(id);
  if (!site?.wordpress) return new Response("This site has no results yet.", { status: 404 });
  if (!EXPORT_TYPES.includes(type as ExportType)) return new Response("Unknown export.", { status: 404 });

  const search = new URL(request.url).searchParams;
  const range = cleanRange({ from: search.get("from") ?? undefined, to: search.get("to") ?? undefined });

  try {
    const { filename, rows } = await getExport(site.wordpress, type as ExportType, range);
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
