"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/*
  A short guided tour of the builder, shown automatically the first time
  someone opens the builder, and on demand from the "Tour" button after that.

  "First time" is remembered per signed-in user in this browser
  (localStorage). When accounts are stored on the server this flag moves to
  the user's record so it follows them between devices.

  Each step points at an element marked with data-tour="...". If that element
  is not on screen (for example the side panels on a phone), the step is shown
  as a centred card instead, so the tour works at any size.
*/

type Step = {
  /** data-tour names to try, first visible one wins. None = centred card. */
  targets?: string[];
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome to the builder",
    body: "Build a consultation site from ready-made blocks. This tour shows the six things you need, and takes about a minute.",
  },
  {
    targets: ["palette", "palette-mobile"],
    title: "Add blocks",
    body: "Drag a block onto the page, or click it to add it to the end. Use the search if you know what you want.",
  },
  {
    targets: ["canvas"],
    title: "Your page",
    body: "Click any block to edit it. Its toolbar moves it up or down, copies it or deletes it, and the handle lets you drag it.",
  },
  {
    targets: ["inspector", "inspector-mobile"],
    title: "The edit panel",
    body: "Change text and upload images here. The eye icon hides a part without deleting it, and Style sets the background, spacing and which devices show the block.",
  },
  {
    targets: ["themes"],
    title: "Pick a theme",
    body: "A theme sets colours, type and corners for the whole page in one click. You can still change the brand colour afterwards.",
  },
  {
    targets: ["devices"],
    title: "Check every screen",
    body: "Switch between desktop, tablet and phone to see the real layout visitors get on each.",
  },
  {
    targets: ["preview"],
    title: "Preview",
    body: "Open the page full screen, exactly as visitors will see it. Your work saves automatically as you go.",
  },
];

/* ---------- First-time flag ---------- */

const noop = () => () => {};

export function useTourSeen(user: string) {
  const key = `openplan:tour-seen:${user}`;
  /* On the server, and until the browser is read, treat the tour as seen so it never flashes. */
  const stored = useSyncExternalStore(
    noop,
    () => {
      try {
        return window.localStorage.getItem(key) === "1";
      } catch {
        return true;
      }
    },
    () => true,
  );
  const [seenNow, setSeenNow] = useState(false);

  function markSeen() {
    setSeenNow(true);
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      /* Private mode: the tour may show again next time, which is harmless. */
    }
  }

  return { seen: stored || seenNow, markSeen };
}

/* ---------- The tour ---------- */

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(names: string[] | undefined): HTMLElement | null {
  for (const name of names ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(
      `[data-tour="${name}"]`,
    )) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return el;
    }
  }
  return null;
}

const CARD_W = 320;
const GAP = 14;

/** Places the card beside the highlighted area, on whichever side has room. */
function cardPosition(
  rect: Rect,
  cardH: number,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampTop = (top: number) =>
    Math.max(12, Math.min(top, vh - cardH - 12));
  const clampLeft = (left: number) =>
    Math.max(12, Math.min(left, vw - CARD_W - 12));

  if (rect.left + rect.width + GAP + CARD_W <= vw - 12)
    return { left: rect.left + rect.width + GAP, top: clampTop(rect.top) };
  if (rect.left - GAP - CARD_W >= 12)
    return { left: rect.left - GAP - CARD_W, top: clampTop(rect.top) };
  if (rect.top + rect.height + GAP + cardH <= vh - 12)
    return { left: clampLeft(rect.left), top: rect.top + rect.height + GAP };
  return { left: clampLeft(rect.left), top: clampTop(rect.top - GAP - cardH) };
}

export function Tour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(200);
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduce = useReducedMotion() ?? false;
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  /* Follow the target as the window resizes or the page scrolls. */
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = findTarget(step.targets);
        if (!el) return setRect(null);
        const r = el.getBoundingClientRect();
        /* Keep tall targets (the canvas) inside the viewport. */
        const top = Math.max(r.top, 8);
        const bottom = Math.min(r.bottom, window.innerHeight - 8);
        setRect({
          top,
          left: r.left,
          width: r.width,
          height: Math.max(0, bottom - top),
        });
        if (card.current) setCardH(card.current.offsetHeight);
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step]);

  /* Keys work wherever focus is while the tour is open. */
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIndex(0);
        onClose();
      } else if (event.key === "ArrowRight") setIndex((i) => Math.min(i + 1, STEPS.length - 1));
      else if (event.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function finish() {
    setIndex(0);
    onClose();
  }

  if (!open || typeof document === "undefined") return null;

  const pad = 6;
  const spot = rect && {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  const narrow = window.innerWidth < 640;
  const place = spot && !narrow ? cardPosition(spot, cardH) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70]"

    >
      {/* Dim everything except the highlighted area. Clicks on the page are blocked while the tour runs. */}
      {spot ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl shadow-[0_0_0_9999px_rgba(19,23,19,0.55)] ring-2 ring-white/80"
          initial={false}
          animate={spot}
          transition={{ duration: reduce ? 0 : 0.35, ease: EASE_OUT }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-ink/55" />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          ref={(node) => {
            card.current = node;
            node?.focus();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className={cn(
            "absolute rounded-2xl bg-white p-5 shadow-[0_24px_60px_-20px_rgba(19,23,19,0.55)] outline-none",
            place
              ? ""
              : narrow
                ? "inset-x-3 bottom-3"
                : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          )}
          style={
            place
              ? { top: place.top, left: place.left, width: CARD_W }
              : narrow
                ? undefined
                : { width: 380 }
          }
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink/45">
              {index === 0
                ? "Quick tour"
                : `Step ${index} of ${STEPS.length - 1}`}
            </p>
            <button
              type="button"
              onClick={finish}
              aria-label="Close the tour"
              className="-mr-1.5 -mt-1.5 grid size-7 place-items-center rounded-full text-ink/50 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <h2
            id={titleId}
            className="mt-1.5 text-[1.12rem] font-medium leading-snug tracking-[-0.01em] text-ink"
          >
            {step.title}
          </h2>
          <p className="mt-1.5 text-[0.86rem] leading-[1.55] text-ink/70">
            {step.body}
          </p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex gap-1" aria-hidden="true">
              {STEPS.map((_, dot) => (
                <span
                  key={dot}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    dot === index ? "w-4 bg-ink" : "w-1.5 bg-ink/15",
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {index === 0 ? (
                <button
                  type="button"
                  onClick={finish}
                  className="h-9 rounded-full px-3 text-[0.82rem] text-ink/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
                >
                  Skip
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIndex(index - 1)}
                  aria-label="Previous step"
                  className="grid size-9 place-items-center rounded-full border border-ink/15 text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => (last ? finish() : setIndex(index + 1))}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[0.84rem] font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {index === 0 ? "Show me" : last ? "Start building" : "Next"}
                {!last && (
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
