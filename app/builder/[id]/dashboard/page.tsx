import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/builder/top-bar";
import { Dashboard } from "@/components/dashboard/dashboard";
import { SiteNav } from "@/components/dashboard/site-nav";
import { WordPressNotice } from "@/components/dashboard/wordpress-notice";
import { getSession } from "@/lib/auth";
import { getSite } from "@/lib/sites";
import { WordPressError, getDashboard } from "@/lib/wordpress";

export const instant = false;

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/login?next=/builder/${id}/dashboard`);

  const site = getSite(id);
  if (!site?.wordpress) notFound();

  let data;
  let error: string | null = null;
  try {
    data = await getDashboard(site.wordpress);
  } catch (e) {
    error = e instanceof WordPressError ? e.message : "Could not load the results.";
  }

  return (
    <>
      <TopBar session={session}>
        <SiteNav site={site} />
      </TopBar>
      <main className="min-h-[calc(100svh-3.5rem)] bg-paper">
        {data ? <Dashboard siteId={site.id} initial={data} /> : <WordPressNotice message={error ?? ""} />}
      </main>
    </>
  );
}
