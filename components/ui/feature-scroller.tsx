"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { useLenis } from "lenis/react";
import { ChevronRight } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { EASE_CARD, EASE_IN_OUT } from "@/lib/motion";
import { CONTAINER, SPLIT } from "@/lib/layout";
import { cn } from "@/lib/utils";

/*
  Pinned feature scroller (desktop). The section pins while the visitor
  scrolls; each feature owns an equal slice of the scroll. The active
  feature's text opens on the left, and the panel on the right changes
  colour and swaps its card. A rail fills with overall progress, and the
  titles jump to their feature. Scrolling back rewinds it.
*/

export type ScrollerTone = "peach" | "blue" | "lime" | "lilac";

export type ScrollerFeature = {
  eyebrow: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  tone: ScrollerTone;
  visual: ReactNode;
};

const TONE_HEX: Record<ScrollerTone, string> = {
  peach: "#ffd2bf",
  blue: "#bfe9ff",
  lime: "#edffc0",
  lilac: "#d9bfff",
};

/** Scroll distance given to each feature, as a share of the screen height. */
const STEP_SVH = 30;

const HAIRLINES =
  "repeating-linear-gradient(90deg, rgba(19,23,19,0.18) 0 1px, transparent 1px 9px)";

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function FeatureScroller({
  features,
  header,
}: {
  features: ScrollerFeature[];
  /** Pinned above the list and panel, so it stays in view. */
  header?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion() ?? false;
  const lenis = useLenis();
  const [active, setActive] = useState(0);
  const n = features.length;

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // Only re-render when the active feature actually changes.
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(n - 1, Math.max(0, Math.floor(p * n)));
    setActive((cur) => (cur === next ? cur : next));
  });

  const jump = useCallback(
    (i: number) => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const distance = el.offsetHeight - window.innerHeight;
      const target = top + (distance / n) * (i + 0.3);
      if (lenis) lenis.scrollTo(target, { duration: reduce ? 0 : 1.1, easing: easeInOutCubic });
      else window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" });
    },
    [lenis, n, reduce],
  );

  const current = features[active];

  return (
    <div ref={ref} className="relative" style={{ height: `${n * STEP_SVH}svh` }}>
      <div className="sticky top-0 flex h-svh flex-col justify-start gap-5 pb-6 pt-[80px] xl:gap-6">
        {header}
        <div className={cn("w-full", CONTAINER, SPLIT)}>
          {/* Text column with progress rail */}
          <div className="relative flex gap-6">
            <div className="relative w-px shrink-0 self-stretch bg-ink/10" aria-hidden="true">
              <motion.div
                className="absolute inset-x-0 top-0 h-full origin-top bg-ink"
                style={{ scaleY: scrollYProgress }}
              />
            </div>

            <ol className="flex min-w-0 flex-col gap-3.5">
              {features.map((f, i) => {
                const isActive = i === active;
                return (
                  <li key={f.title}>
                    <button
                      type="button"
                      onClick={() => jump(i)}
                      aria-current={isActive ? "step" : undefined}
                      className="group block w-full rounded-sw text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                    >
                      <span
                        className={cn(
                          "flex items-center gap-2 font-mono text-[0.69rem] uppercase tracking-[0.1em] transition-colors duration-500",
                          isActive ? "text-ink/70" : "text-ink/35 group-hover:text-ink/55",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                        <span className="h-px w-5 bg-current" aria-hidden="true" />
                        {f.eyebrow}
                      </span>
                      <span
                        className={cn(
                          "mt-1.5 block text-balance text-[clamp(1.5rem,2.2vw,2.2rem)] font-medium leading-[1.1] tracking-[-0.02em] transition-colors duration-500",
                          isActive ? "text-ink" : "text-ink/30 group-hover:text-ink/50",
                        )}
                      >
                        {f.title}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.div
                          key="detail"
                          className="overflow-hidden"
                          initial={reduce ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.5, ease: EASE_IN_OUT }}
                        >
                          <p className="max-w-[30rem] pt-2 text-pretty text-[1.1rem] leading-[1.5] text-ink/75">
                            {f.body}
                          </p>
                          {f.cta && (
                            <a
                              href={f.cta.href}
                              className="group/cta mt-3 inline-flex items-center gap-1 rounded-sw border border-ink/15 px-4 py-2 text-[1rem] text-ink transition-colors duration-300 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                            >
                              {f.cta.label}
                              <ChevronRight
                                className="size-4 transition-transform duration-300 group-hover/cta:translate-x-0.5"
                                strokeWidth={1.6}
                                aria-hidden="true"
                              />
                            </a>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Panel: colour crossfades, card swaps */}
          <motion.div
            className="relative flex aspect-[16/10] max-h-[58svh] w-full max-w-[60rem] items-center justify-center overflow-hidden rounded-[6px]"
            initial={false}
            animate={{ backgroundColor: TONE_HEX[current.tone] }}
            transition={{ duration: 0.7, ease: EASE_CARD }}
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
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="relative"
                initial={reduce ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.4, ease: EASE_CARD }}
              >
                {current.visual}
              </motion.div>
            </AnimatePresence>

            <span className="absolute bottom-3 right-4 font-mono text-[0.62rem] tabular-nums text-ink/60">
              {String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
