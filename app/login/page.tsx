import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { ChecklistVisual } from "@/components/ui/feature-ui-row";
import { getSession } from "@/lib/auth";
import { PRODUCT } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Log in – ${PRODUCT.name}`,
};

/* Reads the session cookie to bounce people who are already signed in,
   so this route is rendered per request rather than prerendered. */
export const instant = false;

const HAIRLINES =
  "repeating-linear-gradient(90deg, rgba(19,23,19,0.18) 0 1px, transparent 1px 9px)";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  /* Already signed in? Go straight through. */
  if (await getSession()) redirect("/builder");

  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/builder";

  return (
    <main className="grid min-h-svh w-full grid-cols-[minmax(0,1fr)] bg-white text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Form column */}
      <div className="flex flex-col px-2.5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] min-[810px]:px-5">
        <header className="flex h-[52px] items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-baseline gap-3 rounded-sw focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            <span className="text-lg font-medium tracking-[-0.01em]">{PRODUCT.name}</span>
            <span className="hidden font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/60 sm:inline">
              by {PRODUCT.maker}
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[0.94rem] text-ink/70 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to site
          </Link>
        </header>

        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-[24rem]">
            <p className="font-mono text-[0.69rem] uppercase tracking-[0.1em] text-ink/60">
              Client login
            </p>
            <h1 className="mt-4 text-balance text-[clamp(2rem,4vw,2.84rem)] font-medium leading-[1.05] tracking-[-0.02em]">
              Log in to your consultations
            </h1>
            <p className="mt-3 text-[1.02rem] leading-[1.5] text-ink/75">
              Manage pages, read comments and download survey results.
            </p>
            <div className="mt-8">
              <LoginForm next={target} />
            </div>
          </div>
        </div>

        <p className="text-center font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink/50 lg:text-left">
          © {PRODUCT.maker} Ltd
        </p>
      </div>

      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-peach lg:flex lg:items-center lg:justify-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/4"
          style={{
            backgroundImage: HAIRLINES,
            maskImage: "linear-gradient(90deg, #000, transparent)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1/4"
          style={{
            backgroundImage: HAIRLINES,
            maskImage: "linear-gradient(270deg, #000, transparent)",
          }}
        />
        <div className="relative">
          <ChecklistVisual
            title="Your consultations"
            rows={[
              { label: "Millbrook Yards", value: "Live" },
              { label: "Canal-side homes", value: "Live" },
              { label: "Station Quarter", value: "Draft", done: false },
            ]}
          />
        </div>
      </div>
    </main>
  );
}
