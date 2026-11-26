/*
  Plan layer images stored in the WordPress media library, served from this
  app's own address. The map draws them with WebGL, which can only use
  pictures from another site when that site allows it (CORS), and WordPress
  does not by default.

  Only images under the configured WordPress's uploads folder are passed on,
  so this can never be used to fetch anything else.
*/

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get("src") ?? "";
  const base = process.env.WP_API_URL;
  if (!base) return new Response("Not found.", { status: 404 });

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return new Response("Not found.", { status: 404 });
  }
  const allowed = new URL(base);
  if (target.origin !== allowed.origin || !target.pathname.includes("/wp-content/uploads/") || target.pathname.includes("..")) {
    return new Response("Not found.", { status: 404 });
  }

  const upstream = await fetch(target, { cache: "no-store" }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";
  if (!upstream?.ok || !/^image\/(webp|png|jpeg)$/.test(type)) return new Response("Not found.", { status: 404 });

  return new Response(upstream.body, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}

