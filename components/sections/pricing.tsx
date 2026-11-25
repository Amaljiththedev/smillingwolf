"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useId, useRef, useState, type CSSProperties } from "react";
import { USAGE_BILLING_SVG } from "@/components/illustrations/usage-billing";
import { IllosArt } from "@/components/ui/illos-art";
import { EASE_CARD } from "@/lib/motion";
import { SectionHeading } from "@/components/ui/section-heading";
import { CONTAINER, GUTTER, SECTION_Y, SPLIT, VISUAL_MAX } from "@/lib/layout";
import { PRICING } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/*
  Pricing – one centred card, following the illos-usage-pricing reference:
  illustration, plan name, price, description, an estimate box with a
  slider, a ticked list and a full-width button. Styled to the design bible
  with a light glass finish over soft blurred brand colour.
  The figure comes from lib/pricing.ts and is tagged as an example until
  it is confirmed.
*/

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: PRICING.currency,
  maximumFractionDigits: 0,
});

const ILLOS_COLOURS = {
  "--illos-ink": "#131713",
  "--illos-ground": "#ffffff",
  "--illos-accent": "#ff8c88",
  "--illos-dark": 0,
} as CSSProperties;

function PricingCard() {
  const id = useId();
  const [sites, setSites] = useState<number>(PRICING.defaultSites);
  const cost = sites * PRICING.perSiteMonthly;

  return (
    <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-ink/10 bg-white/75 shadow-[0_30px_80px_-40px_rgba(19,23,19,0.4)] backdrop-blur-xl">
      <IllosArt
        svg={USAGE_BILLING_SVG}
        className="w-full border-b border-ink/10"
        style={ILLOS_COLOURS}
      />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink/60">{PRICING.planName}</span>
          <p className="flex items-baseline gap-1.5">
            <span className="text-3xl font-medium tracking-tight text-ink">
              {money.format(PRICING.perSiteMonthly)}
            </span>
            <span className="text-sm text-ink/60">{PRICING.unitLabel}</span>
          </p>
          <p className="text-sm leading-relaxed text-ink/70">{PRICING.description}</p>
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-ink/[0.05] p-4">
          <label htmlFor={id} className="flex items-center justify-between text-sm text-ink">
            <span>Live consultation sites</span>
            <span className="font-medium tabular-nums">{sites}</span>
          </label>
          <input
            id={id}
            type="range"
            min={PRICING.minSites}
            max={PRICING.maxSites}
            step={1}
            value={sites}
            onChange={(e) => setSites(Number(e.target.value))}
            className="w-full accent-[#131713]"
          />
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink/60">Estimated bill</span>
            <span className="font-medium tabular-nums text-ink">{money.format(cost)} / month</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5">
          {PRICING.included.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-ink">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {f}
            </li>
          ))}
        </ul>

        <a
          href="#demo"
          className="inline-flex h-10 w-full items-center justify-center rounded-sw bg-coral px-4 text-sm font-medium text-ink transition-colors duration-300 hover:bg-peach focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {PRICING.ctaLabel}
        </a>
      </div>
    </div>
  );
}

export function Pricing() {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion() ?? false;
  const show = inView || reduce;

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className={cn("overflow-x-clip bg-white", GUTTER, SECTION_Y)}
    >
      <div ref={ref} className={CONTAINER}>
        <motion.header
          className="mb-6 md:mb-8"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8, ease: EASE_CARD }}
        >
          <SectionHeading
            id="pricing-title"
            label="Pricing"
            title="Simple pricing for each consultation."
          />
        </motion.header>

        <div className={cn(SPLIT, "lg:items-start")}>
          {/* Text */}
          <motion.div
            className="flex max-w-[30rem] flex-col items-start gap-5"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.8, ease: EASE_CARD, delay: 0.08 }}
          >
            <p className="text-pretty text-[1.2rem] leading-[1.5] text-ink/75">
              Move the slider to estimate the cost for the number of consultation sites you need.
              Running a council or multi-site programme? We&rsquo;ll put a price together with you.
            </p>
            {!PRICING.confirmed && (
              <span className="rounded-full border border-ink/15 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/70">
                Example pricing · to be confirmed
              </span>
            )}
            <a
              href="#demo"
              className="inline-flex h-12 items-center rounded-sw border border-ink/15 px-6 text-[1rem] text-ink transition-colors duration-300 hover:border-ink/30 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Talk to us about a programme price
            </a>
          </motion.div>

          {/* Card */}
          <motion.div
            className={cn(
              "relative isolate flex w-full justify-center py-4 lg:justify-start",
              VISUAL_MAX,
            )}
            initial={reduce ? false : { opacity: 0, y: 48 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.95, ease: EASE_CARD, delay: 0.15 }}
          >
            {/* Soft colour behind the glass */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-1/2 -z-10 h-[90%] w-[min(44rem,100%)] -translate-y-1/2"
            >
              <span className="absolute left-[-8%] top-[8%] size-[55%] rounded-full bg-peach opacity-70 blur-3xl motion-safe:animate-drift" />
              <span
                className="absolute right-0 top-[30%] size-[50%] rounded-full bg-lilac opacity-60 blur-3xl motion-safe:animate-drift"
                style={{ animationDelay: "-6s" }}
              />
              <span
                className="absolute bottom-0 left-[20%] size-[50%] rounded-full bg-blue opacity-60 blur-3xl motion-safe:animate-drift"
                style={{ animationDelay: "-12s" }}
              />
            </div>
            <PricingCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
