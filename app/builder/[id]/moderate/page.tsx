import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/builder/top-bar";
import { Moderation } from "@/components/dashboard/moderation";
import { SiteNav } from "@/components/dashboard/site-nav";
import { WordPressNotice } from "@/components/dashboard/wordpress-notice";
import { getSession } from "@/lib/auth";
import { getSite } from "@/lib/sites";
import { WordPressError, getComments, getDashboard } from "@/lib/wordpress";

export const instant = false;

export default async function ModeratePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/login?next=/builder/${id}/moderate`);

  const site = getSite(id);
  if (!site?.wordpress) notFound();

  let loaded;
  let error: string | null = null;
  try {
    const [comments, dashboard] = await Promise.all([getComments(site.wordpress, "all"), getDashboard(site.wordpress)]);
    loaded = { comments, themeLabels: dashboard.themeLabels, name: dashboard.site.name };
  } catch (e) {
    error = e instanceof WordPressError ? e.message : "Could not load the comments.";
  }

  return (
    <>
      <TopBar session={session}>
        <SiteNav site={site} />
      </TopBar>
      <main className="min-h-[calc(100svh-3.5rem)] bg-paper">
        {loaded ? (
          <Moderation siteId={site.id} name={loaded.name} initial={loaded.comments} themeLabels={loaded.themeLabels} />
        ) : (
          <WordPressNotice message={error ?? ""} />
        )}
      </main>
    </>
  );
}
