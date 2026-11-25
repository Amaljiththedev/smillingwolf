import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PRODUCT } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Builder – ${PRODUCT.name}`,
};

/* Behind the session cookie, so always rendered per request. */
export const instant = false;

/*
  Everything under /builder is behind the session. Middleware turns anonymous
  visitors away already; this second check means a page can read the session
  without re-fetching it, and the app fails closed if the matcher ever changes.
*/
export default async function BuilderLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/builder");

  return <div className="min-h-svh bg-white text-ink">{children}</div>;
}
