import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import { TopBar } from "@/components/builder/top-bar";
import { getSession } from "@/lib/auth";
import { DEMO_SITES, type Site } from "@/lib/sites";
import { cn } from "@/lib/utils";

export const instant = false;

/* One card per consultation site. Clicking through opens the editor. */
function SiteCard({ site }: { site: Site }) {
  const live = site.status === "live";
  return (
    <Link
      href={`/builder/${site.id}`}
      className={cn(
        "group flex flex-col gap-4 rounded-sw border border-ink/10 bg-white p-4 text-left",
        "transition-[border-color,box-shadow] duration-200 hover:border-ink/25",
        "hover:shadow-[0_12px_30px_-18px_rgba(19,23,19,0.4)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
      )}
    >
      {/* Brand swatch strip */}
      <span
        aria-hidden="true"
        className="h-14 w-full rounded-[3px] border border-ink/5"
        style={{ backgroundColor: site.brand.accent }}
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 truncate text-[1.05rem] font-medium tracking-[-0.01em] text-ink">
            {site.name}
          </h2>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.1em]",
              live ? "bg-lime text-ink" : "border border-ink/15 text-ink/60",
            )}
          >
            {site.status}
          </span>
        </div>
        <p className="truncate font-mono text-[0.68rem] text-ink/55">{site.domain}</p>
        <p className="text-[0.8rem] text-ink/60">
          {site.blocks.length} {site.blocks.length === 1 ? "block" : "blocks"} · edited{" "}
          {site.updatedAt}
        </p>
      </div>
    </Link>
  );
}

export default async function BuilderHome() {
  const session = await getSession();
  if (!session) redirect("/login?next=/builder");

  return (
    <>
      <TopBar session={session} />

      <main className="mx-auto w-full max-w-[72rem] px-4 py-8 min-[810px]:px-6 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ink/55">
              Your consultations
            </p>
            <h1 className="mt-2 text-[clamp(1.6rem,3vw,2.1rem)] font-medium leading-[1.1] tracking-[-0.02em]">
              Sites
            </h1>
          </div>
          <button
            type="button"
            disabled
            title="Creating sites comes with the editor"
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-sw bg-coral px-4 text-[0.95rem] font-medium text-ink",
              "transition-colors duration-200 hover:bg-peach disabled:cursor-not-allowed disabled:opacity-50",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
            )}
          >
            <Plus className="size-4" aria-hidden="true" />
            New site
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_SITES.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>

        <p className="mt-8 flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/45">
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
          Example data · the editor and saved sites come next
        </p>
      </main>
    </>
  );
}
