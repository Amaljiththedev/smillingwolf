import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { PRODUCT } from "@/lib/brand";
import type { Session } from "@/lib/session";
import { cn } from "@/lib/utils";

/* The bar across every builder screen: product mark, who is signed in, log out. */
export function TopBar({ session, children }: { session: Session; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-ink/10 bg-white px-4 min-[810px]:px-6">
      <Link
        href="/builder"
        className="flex shrink-0 items-baseline gap-2.5 rounded-sw focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      >
        <span className="text-[1.05rem] font-medium tracking-[-0.01em] text-ink">
          {PRODUCT.name}
        </span>
        <span className="hidden font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/50 sm:inline">
          by {PRODUCT.maker}
        </span>
      </Link>

      {/* Screen-specific controls sit in the middle */}
      <div className="flex min-w-0 flex-1 items-center">{children}</div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden text-[0.85rem] text-ink/70 sm:inline" title={session.email}>
          {session.name}
        </span>
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-peach text-[0.7rem] font-medium text-ink"
        >
          {session.name.charAt(0).toUpperCase()}
        </span>
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-sw border border-ink/15 px-2.5",
              "text-[0.85rem] text-ink transition-colors duration-200 hover:bg-ink/5",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
            )}
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
