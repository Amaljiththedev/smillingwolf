import { getSession } from "@/lib/auth";
import { getSite } from "@/lib/sites";
import { getDashboard } from "@/lib/wordpress";

/*
  The masterplan drawings, served from this app so the map can draw them
  (browsers block reading pixels from another origin). Only the images named
  in the scheme's own plan settings can be fetched: "base" or a layer number.
*/

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; layer: string }> }) {
  if (!(await getSession())) return new Response("Log in first.", { status: 401 });

  const { id, layer } = await params;
  const site = getSite(id);
  if (!site?.wordpress) return new Response("Not found.", { status: 404 });

  let source: string | undefined;
  try {
    const { plan } = await getDashboard(site.wordpress);
    if (plan) source = layer === "base" ? plan.base : /^\d+$/.test(layer) ? plan.layers[Number(layer)]?.url : undefined;
  } catch {
    return new Response("WordPress is unavailable.", { status: 502 });
  }

  /* Only ever fetch from the configured WordPress host. */
  const allowed = new URL(process.env.WP_API_URL ?? "http://invalid").origin;
  if (!source || new URL(source, allowed).origin !== allowed) return new Response("Not found.", { status: 404 });

  const upstream = await fetch(source, { cache: "no-store" }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";
  if (!upstream?.ok || !type.startsWith("image/")) return new Response("Not found.", { status: 404 });

  return new Response(upstream.body, {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=300" },
  });
}
