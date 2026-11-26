"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import type { Site } from "@/lib/sites";
import { cn } from "@/lib/utils";

/*
  The middle of the top bar on every screen of one site: back to Sites, the
  site name, then the site's screens. The pill under the current screen
  slides between tabs.
*/

const TABS = [
  { href: "", label: "Editor" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/moderate", label: "Moderation" },
  { href: "/report", label: "Report" },
] as const;

export function SiteNav({ site, extra }: { site: Pick<Site, "id" | "name" | "wordpress">; extra?: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/builder/${site.id}`;
  const tabs = site.wordpress ? TABS : TABS.slice(0, 1);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Link
        href="/builder"
        className="inline-flex shrink-0 items-center gap-1.5 text-[0.85rem] text-ink/65 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Sites</span>
      </Link>
      <span aria-hidden="true" className="h-4 w-px shrink-0 bg-ink/15" />
      <span className="hidden max-w-[14rem] truncate text-[0.9rem] font-medium text-ink xl:inline" title={site.name}>{site.name}</span>

      <nav aria-label="Site screens" className="min-w-0 overflow-x-auto">
        <ul className="flex items-center gap-0.5 rounded-sw border border-ink/10 p-0.5">
          {tabs.map((tab) => {
            const href = base + tab.href;
            const current = tab.href === "" ? pathname === base : pathname.startsWith(href);
            return (
              <li key={tab.label} className="relative">
                {current && (
                  <motion.span
                    layoutId="site-nav-pill"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[3px] bg-ink"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative z-10 block whitespace-nowrap rounded-[3px] px-2.5 py-1 text-[0.8rem] transition-colors duration-200",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                    current ? "text-white" : "text-ink/65 hover:text-ink",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {extra}
    </div>
  );
}
