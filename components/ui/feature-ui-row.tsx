"use client";

import { motion, useInView, useReducedMotion, type TargetAndTransition } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { SPLIT } from "@/lib/layout";
import { Odometer } from "@/components/ui/odometer";
import { EASE_CARD } from "@/lib/motion";
import { cn } from "@/lib/utils";

/*
  Feature row – text on one side, a coloured panel with a floating visual on
  the other. Adapted from the "feature-ui-row" reference to the design bible:
  Bagoss type, brand accent panels, ink on colour, 4px radius, white only.
  Everything animates once when it scrolls into view; reduced motion shows
  the finished state.
*/

/* ---------- shared ---------- */

/** Scroll-reveal state: `show` turns true once the element is 30% on screen. */
function useReveal<T extends Element>() {
  const ref = useRef<T | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion() ?? false;
  return { ref, show: inView || reduce, reduce };
}

/** Motion props that move from `from` to rest when `show` turns true. */
function reveal(
  show: boolean,
  reduce: boolean,
  from: TargetAndTransition,
  delay = 0,
  duration = 0.95,
) {
  return {
    initial: reduce ? false : from,
    animate: show ? { opacity: 1, x: 0, y: 0, scale: 1 } : undefined,
    transition: { duration, ease: EASE_CARD, delay },
  } as const;
}

function ExampleTag() {
  return (
    <span className="rounded-sw border border-ink/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.1em] text-ink/60">
      Example
    </span>
  );
}

/** Frosted frame around a white card. */
function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[8px] border border-white/70 bg-white/35 p-1.5 shadow-[0_30px_70px_-30px_rgba(19,23,19,0.4)] backdrop-blur-md",
        className,
      )}
    >
      <div className="rounded-sw bg-white p-4">{children}</div>
    </div>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3">
      <p className="text-[0.88rem] font-medium tracking-[-0.01em] text-ink">{children}</p>
      <ExampleTag />
    </div>
  );
}

type Stat = { value: number; suffix?: string; label: string };

function StatCard({ stat, show, reduce }: { stat: Stat; show: boolean; reduce: boolean }) {
  return (
    <motion.div
      className="absolute -right-1 -top-20 z-10 rounded-sw border border-ink/10 bg-lime px-5 py-4 text-ink shadow-[0_18px_40px_-18px_rgba(19,23,19,0.45)] md:-right-10"
      {...reveal(show, reduce, { opacity: 0, y: 24 }, 0.2, 0.9)}
    >
      <div className="font-medium tracking-[-0.02em]">
        <Odometer value={stat.value} size={40} run={show} suffix={stat.suffix} delay={0.4} />
      </div>
      <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/70">
        {stat.label}
      </p>
    </motion.div>
  );
}

/* ---------- visuals ---------- */

export type ChecklistVisualProps = {
  title: string;
  rows: { label: string; value: string; done?: boolean }[];
  stat?: Stat;
};

/** A card of ticked rows, e.g. pages and their status. */
export function ChecklistVisual({ title, rows, stat }: ChecklistVisualProps) {
  const { ref, show, reduce } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("relative w-[min(380px,78vw)]", stat && "mt-14")}>
      {stat && <StatCard stat={stat} show={show} reduce={reduce} />}
      <motion.div {...reveal(show, reduce, { opacity: 0, y: 60 })}>
        <GlassCard>
          <CardTitle>{title}</CardTitle>
          <ul>
            {rows.map((r, i) => (
              <motion.li
                key={r.label}
                className="flex items-center justify-between gap-4 border-t border-ink/[0.08] py-2.5 text-[0.82rem]"
                {...reveal(show, reduce, { opacity: 0, y: 14 }, 0.35 + i * 0.09, 0.7)}
              >
                <span className="flex items-center gap-2 text-ink/75">
                  <motion.span
                    className={cn(
                      "grid size-4 place-items-center rounded-full",
                      r.done === false ? "border border-ink/25 bg-white" : "bg-ink text-white",
                    )}
                    initial={reduce ? false : { scale: 0 }}
                    animate={show ? { scale: 1 } : undefined}
                    transition={{
                      type: "spring",
                      bounce: 0.5,
                      duration: 0.5,
                      delay: 0.9 + i * 0.25,
                    }}
                  >
                    {r.done !== false && (
                      <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                    )}
                  </motion.span>
                  {r.label}
                </span>
                <span className="text-ink">{r.value}</span>
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      </motion.div>
    </div>
  );
}

export type BarListVisualProps = {
  title: string;
  items: { label: string; value: number; marker?: string }[];
  /** Appended to each value, e.g. "%". */
  suffix?: string;
  stat?: Stat;
};

/** Ranked bars, e.g. comments by location or survey answers. */
export function BarListVisual({ title, items, suffix = "", stat }: BarListVisualProps) {
  const { ref, show, reduce } = useReveal<HTMLDivElement>();
  const max = Math.max(...items.map((i) => i.value));
  return (
    <div ref={ref} className={cn("relative w-[min(400px,78vw)]", stat && "mt-14")}>
      {stat && <StatCard stat={stat} show={show} reduce={reduce} />}
      <motion.div {...reveal(show, reduce, { opacity: 0, y: 60 })}>
        <GlassCard>
          <CardTitle>{title}</CardTitle>
          <ul className="flex flex-col">
            {items.map((item, i) => (
              <motion.li
                key={item.label}
                className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2.5rem] items-center gap-3 border-t border-ink/[0.08] py-2.5 text-[0.82rem] text-ink"
                {...reveal(show, reduce, { opacity: 0, y: 14 }, 0.35 + i * 0.09, 0.7)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {item.marker && (
                    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-coral text-[0.55rem] font-medium">
                      {item.marker}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                  <motion.span
                    className="block h-full origin-left rounded-full bg-ink"
                    style={{ width: `${(item.value / max) * 100}%` }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={show ? { scaleX: 1 } : undefined}
                    transition={{ duration: 0.9, ease: EASE_CARD, delay: 0.6 + i * 0.12 }}
                  />
                </span>
                <span className="text-right font-mono text-[0.72rem] tabular-nums text-ink/70">
                  {item.value}
                  {suffix}
                </span>
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      </motion.div>
    </div>
  );
}

export type TimelineVisualProps = {
  title: string;
  stages: { label: string; span: number }[];
  /** Labels under the bar, evenly spaced from start to end. */
  ticks: string[];
  note: string;
};

const STAGE_FILLS = ["bg-coral", "bg-peach", "bg-lime", "bg-blue"];

/** A segmented bar that fills stage by stage. */
export function TimelineVisual({ title, stages, ticks, note }: TimelineVisualProps) {
  const { ref, show, reduce } = useReveal<HTMLDivElement>();
  const total = stages.reduce((a, s) => a + s.span, 0);
  // Where each stage starts, as a running total (computed up front, not during render).
  const starts = stages.map((_, i) => stages.slice(0, i).reduce((a, s) => a + s.span, 0));
  return (
    <motion.div
      ref={ref}
      className="w-[min(440px,80vw)]"
      {...reveal(show, reduce, { opacity: 0, y: 60 })}
    >
      <GlassCard>
        <CardTitle>{title}</CardTitle>
        <div className="flex h-10 overflow-hidden rounded-sw bg-ink/[0.06]">
          {stages.map((s, i) => {
            const start = starts[i];
            return (
              <motion.div
                key={s.label}
                className={cn(
                  "flex h-full items-center px-3 text-[0.72rem] text-ink",
                  STAGE_FILLS[i % STAGE_FILLS.length],
                )}
                style={{ width: `${(s.span / total) * 100}%`, transformOrigin: "left" }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={show ? { scaleX: 1 } : undefined}
                transition={{ duration: 0.9, ease: EASE_CARD, delay: 0.4 + (start / total) * 1.2 }}
              >
                <span className="truncate">{s.label}</span>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[0.6rem] tabular-nums text-ink/50">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <motion.p
          className="mt-4 flex items-center gap-2 text-[0.82rem] text-ink/75"
          initial={reduce ? false : { opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
          transition={{ delay: 1.8, duration: 0.6 }}
        >
          <span className="rounded-sw bg-yellow px-1.5 py-0.5 text-[0.68rem] text-ink">Then</span>
          {note}
        </motion.p>
      </GlassCard>
    </motion.div>
  );
}

/* ---------- row ---------- */

export type FeatureTone = "peach" | "lilac" | "blue" | "lime";
const TONES: Record<FeatureTone, string> = {
  peach: "bg-peach",
  lilac: "bg-lilac",
  blue: "bg-blue",
  lime: "bg-lime",
};

export type FeatureUIRowProps = {
  eyebrow: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  visual: ReactNode;
  /** Put the visual on the left. */
  reverse?: boolean;
  /** Brand accent behind the visual. */
  tone?: FeatureTone;
  className?: string;
};

const HAIRLINES =
  "repeating-linear-gradient(90deg, rgba(19,23,19,0.18) 0 1px, transparent 1px 9px)";

export function FeatureUIRow({
  eyebrow,
  title,
  body,
  cta,
  visual,
  reverse,
  tone = "peach",
  className,
}: FeatureUIRowProps) {
  const { ref, show, reduce } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        SPLIT,
        className,
      )}
    >
      <div className={cn("max-w-[28rem]", reverse && "md:order-2")}>
        <motion.p
          className="flex items-center gap-2 font-mono text-[0.69rem] uppercase tracking-[0.1em] text-ink/60"
          {...reveal(show, reduce, { opacity: 0, y: 16 }, 0, 0.7)}
        >
          <span className="h-px w-5 bg-ink/40" aria-hidden="true" />
          {eyebrow}
        </motion.p>
        <motion.h3
          className="mt-6 text-balance text-[clamp(2rem,3.5vw,3rem)] font-medium leading-[1.08] tracking-[-0.02em] text-ink"
          {...reveal(show, reduce, { opacity: 0, y: 20 }, 0.08, 0.8)}
        >
          {title}
        </motion.h3>
        <motion.p
          className="mt-4 text-pretty text-[1.2rem] leading-[1.5] text-ink/75"
          {...reveal(show, reduce, { opacity: 0, y: 20 }, 0.16, 0.8)}
        >
          {body}
        </motion.p>
        {cta && (
          <motion.a
            href={cta.href}
            className="group mt-7 inline-flex items-center gap-1 rounded-sw border border-ink/15 px-4 py-2 text-[0.94rem] text-ink transition-colors duration-300 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            {...reveal(show, reduce, { opacity: 0, y: 16 }, 0.24, 0.7)}
          >
            {cta.label}
            <ChevronRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={1.6}
              aria-hidden="true"
            />
          </motion.a>
        )}
      </div>

      <div
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden rounded-[6px] px-5 py-8 md:px-6 lg:aspect-[4/3] lg:py-0",
          TONES[tone],
          reverse && "md:order-1",
        )}
      >
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
        <div className="relative">{visual}</div>
      </div>
    </div>
  );
}

export default FeatureUIRow;
