"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  CalendarDays,
  Check,
  Heart,
  ListChecks,
  MapIcon,
  PanelTop,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useIntroPlaying } from "@/components/intro/intro-provider";
import { EASE_IN_OUT, EASE_OUT } from "@/lib/motion";

/* The reference component's card easing. */
const EASE_CARD: [number, number, number, number] = [0.42, 0, 0, 1];
import { cn } from "@/lib/utils";

/*
  Hero mockup – the website builder, playing a short loop:
  type the domain → drag in Header, Masterplan map and Survey blocks →
  apply the client's brand → publish → comments, pins and survey answers
  arrive → hold, then start again.
  The site ("Millbrook Yards") and every figure are fictional and the
  canvas is labelled "Example". Reduced motion shows the finished state.
*/

/* ---------- script ---------- */

const SCRIPT = [
  { id: "start", ms: 700 },
  { id: "type", ms: 1500 },
  { id: "pick-header", ms: 650 },
  { id: "drop-header", ms: 850 },
  { id: "pick-map", ms: 650 },
  { id: "drop-map", ms: 950 },
  { id: "pick-survey", ms: 650 },
  { id: "drop-survey", ms: 950 },
  { id: "brand", ms: 1200 },
  { id: "publish", ms: 1300 },
  { id: "live", ms: 4500 },
] as const;

type StepId = (typeof SCRIPT)[number]["id"];
const LAST = SCRIPT.length - 1;
const at = (id: StepId) => SCRIPT.findIndex((s) => s.id === id);

/** Advances through SCRIPT while `run` is true, looping at the end. */
function useScript(run: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t = window.setTimeout(() => setStep((s) => (s >= LAST ? 0 : s + 1)), SCRIPT[step].ms);
    return () => window.clearTimeout(t);
  }, [run, step]);
  return step;
}

/* ---------- content ---------- */

const SITE = {
  name: "Millbrook Yards",
  domain: "haveyoursay.millbrookyards.co.uk",
  pages: ["Overview", "Masterplan", "Survey"],
};

type BlockId = "header" | "map" | "survey";
const BLOCKS: { id: BlockId | "timeline"; label: string; icon: LucideIcon }[] = [
  { id: "header", label: "Header", icon: PanelTop },
  { id: "map", label: "Masterplan map", icon: MapIcon },
  { id: "survey", label: "Survey", icon: ListChecks },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
];

const SWATCHES = ["#c2c698", "#ff8c88", "#bfe9ff"]; // olive is the client's brand
const BRAND = SWATCHES[0];

/* Pin tips in map coordinates (viewBox 400 x 220). */
const PINS = [
  { n: 1, x: 188, y: 92 },
  { n: 2, x: 252, y: 134 },
  { n: 3, x: 300, y: 84 },
  { n: 4, x: 214, y: 172 },
];
const ACTIVE_PIN = { x: 252, y: 134 };
const MAP_W = 400;
const MAP_H = 220;

const SURVEY = {
  question: "How would you travel to the new park?",
  answers: [
    { label: "Walk", value: 46 },
    { label: "Cycle", value: 28 },
    { label: "Bus", value: 18 },
    { label: "Car", value: 8 },
  ],
};

/* ---------- pieces ---------- */

const blockIn = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

/* ---------- realistic masterplan map ---------- */

type Rect = { x: number; y: number; w: number; h: number };

/** Deterministic pseudo-random numbers, so server and client draw the same map. */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t * 1664525 + 1013904223) % 4294967296;
    return t / 4294967296;
  };
}

/** Fills a city block with terraced building footprints along two edges. */
function footprints(block: Rect, rand: () => number): Rect[] {
  const out: Rect[] = [];
  const depth = 9 + rand() * 5;
  for (const edge of ["top", "bottom"] as const) {
    let x = block.x + 1.5;
    while (x < block.x + block.w - 6) {
      const w = Math.min(6 + rand() * 12, block.x + block.w - 1.5 - x);
      const d = depth - rand() * 3;
      out.push({
        x,
        y: edge === "top" ? block.y + 1.5 : block.y + block.h - 1.5 - d,
        w: w - 1,
        h: d,
      });
      x += w;
    }
  }
  return out;
}

const CITY_BLOCKS: Rect[] = [
  { x: 6, y: 6, w: 70, h: 44 },
  { x: 84, y: 6, w: 70, h: 44 },
  { x: 162, y: 6, w: 76, h: 44 },
  { x: 246, y: 6, w: 78, h: 44 },
  { x: 332, y: 6, w: 62, h: 44 },
  { x: 6, y: 58, w: 70, h: 52 },
  { x: 84, y: 58, w: 70, h: 52 },
  { x: 332, y: 58, w: 62, h: 52 },
  { x: 6, y: 118, w: 70, h: 42 },
  { x: 84, y: 118, w: 70, h: 42 },
  { x: 332, y: 118, w: 62, h: 42 },
];
const BUILDINGS = (() => {
  const rand = seeded(7);
  return CITY_BLOCKS.flatMap((b) => footprints(b, rand));
})();

/* Proposed scheme inside the site boundary. */
const PROPOSED: Rect[] = [
  { x: 166, y: 62, w: 34, h: 22 },
  { x: 206, y: 62, w: 22, h: 40 },
  { x: 282, y: 64, w: 38, h: 16 },
  { x: 294, y: 98, w: 28, h: 30 },
  { x: 166, y: 104, w: 30, h: 26 },
];
const TREES = (() => {
  const rand = seeded(21);
  const park = { x: 232, y: 98, w: 54, h: 46 };
  const t = Array.from({ length: 16 }, () => ({
    x: park.x + 4 + rand() * (park.w - 8),
    y: park.y + 4 + rand() * (park.h - 8),
    r: 2.4 + rand() * 1.6,
  }));
  for (let x = 166; x < 326; x += 11) t.push({ x, y: 150 + rand() * 2, r: 2.6 });
  return t;
})();

function MapPinMark({ x, y, n, active }: { x: number; y: number; n: number; active: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0.5" rx="4" ry="1.4" fill="rgba(19,23,19,0.25)" />
      <path
        d="M0 0 C -1.5 -4 -7 -7.5 -7 -13 A 7 7 0 1 1 7 -13 C 7 -7.5 1.5 -4 0 0 Z"
        fill={active ? "#131713" : "#ff8c88"}
        stroke="#ffffff"
        strokeWidth="1.2"
      />
      <text
        y="-10.5"
        textAnchor="middle"
        fontSize="7"
        fontWeight="500"
        fill={active ? "#ffffff" : "#131713"}
      >
        {n}
      </text>
    </g>
  );
}

function Masterplan({ showPins }: { showPins: boolean }) {
  const roads = "M0 54 H400 M0 114 H400 M80 0 V164 M158 0 V164 M242 0 V54 M328 0 V164";
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block h-auto w-full" aria-hidden="true">
      <defs>
        <filter id="mp-shadow" x="-20%" y="-20%" width="160%" height="160%">
          <feDropShadow
            dx="1.6"
            dy="2"
            stdDeviation="1.2"
            floodColor="#131713"
            floodOpacity="0.22"
          />
        </filter>
        <pattern
          id="mp-hatch"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path d="M0 0 V4" stroke="rgba(255,140,136,0.3)" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Land */}
      <rect width={MAP_W} height={MAP_H} fill="#efede8" />

      {/* River */}
      <path
        d="M-10 172 C 60 162, 120 188, 200 180 S 330 162, 410 174 L 410 230 L -10 230 Z"
        fill="#cfe5f1"
        stroke="#b4d3e4"
        strokeWidth="1"
      />
      <text x="96" y="204" fontSize="6" letterSpacing="2" fill="#7fa6bd">
        MILL BROOK
      </text>

      {/* Roads: casing, then surface */}
      <path d={roads} stroke="#dedad3" strokeWidth="8" fill="none" />
      <path d={roads} stroke="#ffffff" strokeWidth="6" fill="none" />
      <g fontSize="5" letterSpacing="1.5" fill="#9a968e">
        <text x="18" y="56">
          CANAL STREET
        </text>
        <text x="342" y="116">
          MILL LANE
        </text>
        <text transform="translate(82 104) rotate(-90)">WHARF ROAD</text>
      </g>

      {/* Existing buildings */}
      <g fill="#dcd8d0" stroke="#cdc8bf" strokeWidth="0.5">
        {BUILDINGS.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} />
        ))}
      </g>

      {/* Site: hatch, park, proposed buildings, trees, boundary */}
      <rect x="162" y="58" width="166" height="98" fill="url(#mp-hatch)" />
      <rect x="232" y="98" width="54" height="46" rx="2" fill="#dbe6c8" />
      <g filter="url(#mp-shadow)">
        {PROPOSED.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill="#ffffff"
            stroke="#c9c4bb"
            strokeWidth="0.5"
          />
        ))}
      </g>
      {TREES.map((t, i) => (
        <circle
          key={i}
          cx={t.x}
          cy={t.y}
          r={t.r}
          fill="#a9bf8e"
          stroke="#8fa874"
          strokeWidth="0.5"
        />
      ))}
      <rect
        x="162"
        y="58"
        width="166"
        height="98"
        fill="none"
        stroke="#ff8c88"
        strokeWidth="1.4"
        strokeDasharray="4 3"
      />

      {/* North arrow */}
      <g transform="translate(384 24)" fill="#131713">
        <path d="M0 -8 L 4 6 L 0 3 L -4 6 Z" />
        <text y="15" textAnchor="middle" fontSize="6">
          N
        </text>
      </g>

      {/* Pins */}
      <AnimatePresence>
        {showPins &&
          PINS.map((p, i) => (
            <motion.g
              key={p.n}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.3 + i * 0.25 }}
            >
              <MapPinMark x={p.x} y={p.y} n={p.n} active={p.x === ACTIVE_PIN.x} />
            </motion.g>
          ))}
      </AnimatePresence>
    </svg>
  );
}

function MapControls() {
  return (
    <>
      <div className="absolute left-2 top-2 flex flex-col overflow-hidden rounded-[3px] border border-ink/10 bg-white text-[0.6rem] leading-none text-ink shadow-sm">
        <span className="grid size-4 place-items-center border-b border-ink/10">+</span>
        <span className="grid size-4 place-items-center">−</span>
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-[3px] bg-white/90 px-1.5 py-1 font-mono text-[0.48rem] text-ink/70">
        <span className="block h-1 w-6 border-x border-b border-ink/60" />
        50 m
      </div>
    </>
  );
}

function SurveyBlock({ live, accent }: { live: boolean; accent: string }) {
  return (
    <div className="rounded-sw border border-ink/10 bg-white p-2.5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[0.65rem] font-medium leading-tight text-ink">{SURVEY.question}</p>
        <motion.p
          className="shrink-0 font-mono text-[0.55rem] text-ink/60"
          animate={{ opacity: live ? 1 : 0 }}
        >
          312 responses
        </motion.p>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {SURVEY.answers.map((a, i) => (
          <li
            key={a.label}
            className="grid grid-cols-[2.2rem_1fr_1.6rem] items-center gap-1.5 text-[0.55rem] text-ink"
          >
            <span>{a.label}</span>
            <span className="h-1 overflow-hidden rounded-full bg-ink/5">
              <motion.span
                className="block h-full origin-left rounded-full"
                style={{ width: `${a.value}%`, backgroundColor: accent }}
                initial={false}
                animate={{ scaleX: live ? 1 : 0 }}
                transition={{ duration: 0.9, ease: EASE_OUT, delay: live ? 1.2 + i * 0.12 : 0 }}
              />
            </span>
            <span className="text-right font-mono text-ink/60">{live ? `${a.value}%` : "–"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Cursor({
  x,
  y,
  scale,
  carrying,
}: {
  x: ReturnType<typeof useMotionValue<number>>;
  y: ReturnType<typeof useMotionValue<number>>;
  scale: ReturnType<typeof useMotionValue<number>>;
  carrying: string | null;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{ x, y }}
      aria-hidden="true"
    >
      <motion.svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        style={{ scale }}
        className="-translate-x-[3px] -translate-y-[2px] drop-shadow"
      >
        <path
          d="M2 1.5 L 15 9 L 9 10.2 L 6.2 16 Z"
          fill="#131713"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </motion.svg>
      <AnimatePresence>
        {carrying && (
          <motion.span
            className="absolute left-4 top-4 whitespace-nowrap rounded-sw border border-ink/15 bg-white px-2 py-1 text-[0.6rem] font-medium text-ink shadow-[0_8px_20px_-8px_rgba(19,23,19,0.4)]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            {carrying}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* Soft blurred colour fields behind the window, in the brand accents. */
function Backdrop() {
  const blobs = [
    { c: "bg-peach", p: "left-[-18%] top-[-20%] size-[65%]", d: "0s" },
    { c: "bg-white", p: "right-[-20%] top-[10%] size-[60%]", d: "-6s" },
    { c: "bg-lime", p: "left-[5%] bottom-[-25%] size-[60%]", d: "-12s" },
    { c: "bg-blue", p: "right-[-5%] bottom-[-20%] size-[50%]", d: "-3s" },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {blobs.map((b) => (
        <span
          key={b.c}
          className={cn(
            "absolute rounded-full opacity-50 blur-3xl motion-safe:animate-drift",
            b.c,
            b.p,
          )}
          style={{ animationDelay: b.d }}
        />
      ))}
    </div>
  );
}

/* Ink hairlines fading in from both edges of the panel. */
function Hairlines() {
  const lines = "repeating-linear-gradient(90deg, rgba(19,23,19,0.16) 0 1px, transparent 1px 9px)";
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1/4"
        style={{ backgroundImage: lines, maskImage: "linear-gradient(90deg, #000, transparent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-1/4"
        style={{ backgroundImage: lines, maskImage: "linear-gradient(270deg, #000, transparent)" }}
      />
    </>
  );
}

/* ---------- cursor choreography ---------- */

type Refs = {
  frame: RefObject<HTMLDivElement | null>;
  url: RefObject<HTMLDivElement | null>;
  canvas: RefObject<HTMLDivElement | null>;
  map: RefObject<HTMLDivElement | null>;
  swatch: RefObject<HTMLSpanElement | null>;
  publish: RefObject<HTMLDivElement | null>;
  items: RefObject<Partial<Record<string, HTMLLIElement | null>>>;
};

function useCursor(stepId: StepId, refs: Refs, enabled: boolean) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);

  useEffect(() => {
    const frame = refs.frame.current;
    if (!enabled || !frame) return;
    const f = frame.getBoundingClientRect();
    const point = (el: Element | null | undefined, fx = 0.5, fy = 0.5) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - f.left + r.width * fx, y: r.top - f.top + r.height * fy };
    };
    const canvas = refs.canvas.current;
    const target = (() => {
      switch (stepId) {
        case "start":
          return { x: f.width * 0.85, y: f.height * 0.9 };
        case "type":
          return point(refs.url.current, 0.3, 0.55);
        case "pick-header":
          return point(refs.items.current.header, 0.4);
        case "pick-map":
          return point(refs.items.current.map, 0.4);
        case "pick-survey":
          return point(refs.items.current.survey, 0.4);
        case "drop-header":
          return point(canvas, 0.45, 0.1);
        case "drop-map":
          return point(canvas, 0.45, 0.42);
        case "drop-survey":
          return point(canvas, 0.45, 0.86);
        case "brand":
          return point(refs.swatch.current);
        case "publish":
          return point(refs.publish.current, 0.5);
        case "live":
          return point(refs.map.current, ACTIVE_PIN.x / MAP_W, (ACTIVE_PIN.y - 8) / MAP_H);
      }
    })();
    if (!target) return;

    const ease = EASE_IN_OUT as [number, number, number, number];
    const moves = [
      animate(x, target.x, { duration: 0.55, ease }),
      animate(y, target.y, { duration: 0.55, ease }),
    ];
    const clicks: StepId[] = [
      "pick-header",
      "pick-map",
      "pick-survey",
      "brand",
      "publish",
      "live",
      "type",
    ];
    if (clicks.includes(stepId)) {
      moves.push(animate(scale, [1, 0.78, 1], { duration: 0.28, delay: 0.55 }));
    }
    return () => moves.forEach((m) => m.stop());
  }, [stepId, enabled, refs, x, y, scale]);

  return { x, y, scale };
}

/* ---------- assembly ---------- */

export function HeroMockup() {
  const reduce = useReducedMotion() ?? false;
  const introPlaying = useIntroPlaying();

  const frame = useRef<HTMLDivElement | null>(null);
  const url = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLDivElement | null>(null);
  const map = useRef<HTMLDivElement | null>(null);
  const swatch = useRef<HTMLSpanElement | null>(null);
  const publish = useRef<HTMLDivElement | null>(null);
  const items = useRef<Partial<Record<string, HTMLLIElement | null>>>({});
  // Ref objects are stable, so this bundle never changes.
  const refs = useMemo<Refs>(() => ({ frame, url, canvas, map, swatch, publish, items }), []);

  const inView = useInView(frame, { amount: 0.35 });
  const playing = !reduce && !introPlaying && inView;
  const scriptStep = useScript(playing);
  const step = reduce ? LAST : scriptStep;
  const stepId = SCRIPT[step].id;
  const past = (id: StepId) => step >= at(id);

  const cursor = useCursor(stepId, refs, playing);

  const typed = past("type");
  const brand = past("brand");
  const live = past("live");
  const publishing = stepId === "publish";
  const accent = brand ? BRAND : "rgba(19,23,19,0.25)";
  const picked = stepId.startsWith("pick-") ? stepId.slice(5) : null;
  const carrying = stepId.startsWith("drop-")
    ? (BLOCKS.find((b) => b.id === stepId.slice(5))?.label ?? null)
    : null;
  const show = {
    header: past("drop-header"),
    map: past("drop-map"),
    survey: past("drop-survey"),
  };
  const dropDelay = (id: StepId) => (stepId === id ? 0.5 : 0);

  return (
    <motion.div
      role="figure"
      aria-label="Example: building a consultation site with the platform"
      className="relative isolate mx-auto w-full max-w-[52rem]"
      initial={reduce ? false : { opacity: 0 }}
      animate={introPlaying ? undefined : { opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }}
    >
      {/* Panel */}
      <div className="relative overflow-hidden rounded-[6px] bg-paper px-3 py-4 sm:px-5 sm:py-5">
        <Backdrop />
        <Hairlines />

        {/* Glass frame */}
        <motion.div
          className="relative z-10 rounded-[8px] border border-white/70 bg-white/35 p-1.5 shadow-[0_30px_70px_-30px_rgba(19,23,19,0.45)] backdrop-blur-md"
          initial={reduce ? false : { opacity: 0, y: 60 }}
          animate={introPlaying ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.95, ease: EASE_CARD, delay: 0.35 }}
        >
          <div ref={frame} className="relative overflow-hidden rounded-sw bg-white">
            {/* Browser bar */}
            <div className="flex items-center gap-3 border-b border-ink/10 px-3 py-2.5">
              <div className="flex gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-2 rounded-full bg-ink/15" />
                ))}
              </div>
              <div
                ref={url}
                className="relative flex min-w-0 flex-1 items-center gap-2 rounded-sw bg-ink/5 px-2.5 py-1 font-mono text-[0.58rem] text-ink/60 sm:text-[0.62rem]"
              >
                <motion.span
                  className="truncate"
                  initial={false}
                  animate={{ clipPath: typed ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" }}
                  transition={{ duration: typed && stepId === "type" ? 1.1 : 0, ease: "linear" }}
                >
                  {SITE.domain}
                </motion.span>
                <span className="ml-auto shrink-0 rounded-sw border border-ink/15 px-1.5 py-0.5 text-[0.5rem] uppercase tracking-[0.1em] text-ink/60">
                  Example
                </span>
                {!typed && <span className="absolute left-2.5 h-3 w-px animate-pulse bg-ink/60" />}
                <AnimatePresence>
                  {live && (
                    <motion.span
                      className="flex shrink-0 items-center gap-1 rounded-full bg-lime px-1.5 py-0.5 text-[0.55rem] text-ink"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <span className="size-1 rounded-full bg-ink" /> Live
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Builder */}
            <div className="grid aspect-[4/3] grid-cols-[2.75rem_minmax(0,1fr)] sm:aspect-[16/9.5] sm:grid-cols-[8.5rem_minmax(0,1fr)]">
              {/* Sidebar */}
              <aside className="flex flex-col gap-3 border-r border-ink/10 bg-white p-2 sm:p-3">
                <p className="hidden font-mono text-[0.55rem] uppercase tracking-[0.1em] text-ink/60 sm:block">
                  Blocks
                </p>
                <ul className="flex flex-col gap-1">
                  {BLOCKS.map((b) => {
                    const Icon = b.icon;
                    const used = b.id !== "timeline" && show[b.id as BlockId];
                    return (
                      <li
                        key={b.id}
                        ref={(el) => {
                          items.current[b.id] = el;
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-sw px-1.5 py-1.5 text-[0.62rem] text-ink transition-colors duration-200",
                          picked === b.id ? "bg-ink/10" : "bg-transparent",
                          used && "text-ink/40",
                        )}
                      >
                        <Icon className="size-3.5 shrink-0" strokeWidth={1.6} aria-hidden="true" />
                        <span className="hidden truncate sm:inline">{b.label}</span>
                        {used && (
                          <Check className="ml-auto hidden size-3 sm:block" aria-hidden="true" />
                        )}
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-1 hidden font-mono text-[0.55rem] uppercase tracking-[0.1em] text-ink/60 sm:block">
                  Brand
                </p>
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  {SWATCHES.map((c, i) => (
                    <span
                      key={c}
                      ref={i === 0 ? swatch : undefined}
                      className={cn(
                        "size-4 rounded-full border border-ink/15 ring-offset-1 transition-shadow sm:size-5",
                        brand && i === 0 && "ring-2 ring-ink",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div
                  ref={publish}
                  className={cn(
                    "mt-auto flex h-7 items-center justify-center gap-1 rounded-sw text-[0.6rem] font-medium text-ink transition-colors duration-300",
                    live ? "bg-lime" : publishing ? "bg-coral" : "bg-ink/5",
                  )}
                >
                  {live ? (
                    <>
                      <Check className="size-3" aria-hidden="true" />
                      <span className="hidden sm:inline">Published</span>
                    </>
                  ) : (
                    <span className="truncate px-1">{publishing ? "Publishing…" : "Publish"}</span>
                  )}
                </div>
              </aside>

              {/* Canvas */}
              <div
                ref={canvas}
                className="relative flex min-w-0 flex-col gap-2 overflow-hidden bg-paper/60 p-2 sm:p-2.5"
              >
                <AnimatePresence initial={false}>
                  {!show.header && !show.map && !show.survey && (
                    <motion.div
                      key="empty"
                      className="absolute inset-2 grid place-items-center rounded-sw border border-dashed border-ink/20 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ink/50 sm:inset-2.5"
                      exit={{ opacity: 0, transition: { duration: 0.2 } }}
                    >
                      Drag blocks here
                    </motion.div>
                  )}

                  {show.header && (
                    <motion.div
                      key="header"
                      layout
                      {...blockIn}
                      transition={{
                        duration: 0.45,
                        ease: EASE_OUT,
                        delay: dropDelay("drop-header"),
                      }}
                      className="flex items-center justify-between gap-2 rounded-sw border border-ink/10 bg-white px-2.5 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-[0.68rem] font-medium tracking-[-0.01em] text-ink">
                        <motion.span
                          className="size-2.5 shrink-0 rounded-[2px]"
                          animate={{ backgroundColor: accent }}
                          transition={{ duration: 0.5 }}
                        />
                        <span className="truncate">{SITE.name}</span>
                      </span>
                      <ul className="hidden gap-2.5 text-[0.55rem] text-ink/60 sm:flex">
                        {SITE.pages.map((p, i) => (
                          <li key={p} className={i === 1 ? "text-ink" : undefined}>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}

                  {show.map && (
                    <motion.div
                      key="map"
                      ref={map}
                      layout
                      {...blockIn}
                      transition={{ duration: 0.45, ease: EASE_OUT, delay: dropDelay("drop-map") }}
                      className="relative overflow-hidden rounded-sw border border-ink/10"
                    >
                      <Masterplan showPins={live} />
                      <MapControls />
                      <AnimatePresence>
                        {live && (
                          <motion.div
                            className="absolute bottom-1.5 right-1.5 hidden w-[9.5rem] rounded-sw border border-ink/10 bg-white px-2 py-1.5 shadow-[0_12px_28px_-12px_rgba(19,23,19,0.35)] sm:block"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: EASE_OUT, delay: 1.5 }}
                          >
                            <div className="mb-1 flex items-center gap-1.5">
                              <span className="grid size-3.5 place-items-center rounded-full bg-blue text-[0.4rem] font-medium text-ink">
                                JT
                              </span>
                              <span className="text-[0.5rem] font-medium text-ink">
                                Local resident · Pin 2
                              </span>
                              <span className="ml-auto flex items-center gap-0.5 text-[0.48rem] text-ink/60">
                                <Heart
                                  className="size-2 fill-coral text-coral"
                                  aria-hidden="true"
                                />{" "}
                                24
                              </span>
                            </div>
                            <p className="text-[0.55rem] leading-snug text-ink">
                              More seating along the canal path, facing the park.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {show.survey && (
                    <motion.div
                      key="survey"
                      layout
                      {...blockIn}
                      transition={{
                        duration: 0.45,
                        ease: EASE_OUT,
                        delay: dropDelay("drop-survey"),
                      }}
                    >
                      <SurveyBlock live={live} accent={accent} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {stepId === "brand" && (
                    <motion.span
                      className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-ink/90 px-2 py-1 text-[0.55rem] text-white"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      <Check className="size-2.5" aria-hidden="true" /> Brand applied
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {playing && <Cursor {...cursor} carrying={carrying} />}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
