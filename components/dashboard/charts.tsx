"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { EASE_CARD, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/*
  Chart pieces for the dashboard, drawn with SVG and HTML in the brand's
  colours so they match the rest of the app. Everything animates once, when
  it scrolls into view; reduced motion shows the final state straight away.
*/

export const fmt = new Intl.NumberFormat("en-GB");

/** Fades and lifts a block into place the first time it is on screen. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={inView || reduce ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, ease: EASE_CARD, delay }}
    >
      {children}
    </motion.div>
  );
}

/** A dashboard card: mono label row, title, optional table toggle. */
export function Card({
  title,
  sub,
  children,
  table,
  action,
  className,
  delay,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  /** When given, a "Table" button swaps the chart for this table. */
  table?: ReactNode;
  action?: ReactNode;
  className?: string;
  delay?: number;
}) {
  const [showTable, setShowTable] = useState(false);
  const headingId = useId();
  return (
    <Reveal className={cn("min-w-0", className)} delay={delay}>
      <section
        aria-labelledby={headingId}
        className="flex h-full flex-col rounded-sw border border-ink/10 bg-white p-4 transition-[border-color,box-shadow] duration-300 hover:border-ink/20 hover:shadow-[0_12px_30px_-22px_rgba(19,23,19,0.45)] md:p-5"
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={headingId} className="text-[1.05rem] font-medium leading-tight tracking-[-0.01em] text-ink">
              {title}
            </h2>
            {sub && <p className="mt-1 text-[0.78rem] text-ink/55">{sub}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {table && (
              <button
                type="button"
                aria-pressed={showTable}
                onClick={() => setShowTable((v) => !v)}
                className={cn(
                  "h-7 rounded-sw border px-2.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] transition-colors duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  showTable ? "border-ink bg-ink text-white" : "border-ink/15 text-ink/65 hover:bg-ink/5 hover:text-ink",
                )}
              >
                Table
              </button>
            )}
          </div>
        </header>
        <div className="mt-4 min-w-0 flex-1">{showTable && table ? table : children}</div>
      </section>
    </Reveal>
  );
}

/** Plain table version of a chart, for screen readers and anyone who wants the numbers. */
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="max-h-[26rem] overflow-auto">
      <table className="w-full border-collapse text-[0.8rem]">
        <thead className="sticky top-0 bg-white">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  "border-b border-ink/15 py-2 pr-3 font-mono text-[0.6rem] font-normal uppercase tracking-[0.1em] text-ink/55",
                  i > 0 ? "text-right" : "text-left",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-ink/5">
              {row.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-1.5 pr-3 text-left font-normal text-ink">
                    {c}
                  </th>
                ) : (
                  <td key={i} className="py-1.5 pr-3 text-right tabular-nums text-ink/80">
                    {typeof c === "number" ? fmt.format(c) : c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One horizontal bar with its label and value. Grows from the left when on screen. */
export function BarRow({
  label,
  value,
  max,
  note,
  colour = "#131713",
  index = 0,
}: {
  label: string;
  value: number;
  max: number;
  note?: string;
  colour?: string;
  index?: number;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const share = max > 0 ? value / max : 0;
  return (
    <li ref={ref} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] items-center gap-3 py-1">
      <span className="min-w-0 text-[0.82rem] leading-snug text-ink/80">{label}</span>
      <span className="relative h-2.5 overflow-hidden rounded-full bg-ink/5" aria-hidden="true">
        <motion.span
          className="absolute inset-y-0 left-0 origin-left rounded-full"
          style={{ width: `${Math.max(share * 100, value > 0 ? 1.5 : 0)}%`, backgroundColor: colour }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={inView || reduce ? { scaleX: 1 } : undefined}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.05 * index }}
        />
      </span>
      <span className="min-w-[4.5rem] text-right text-[0.8rem] tabular-nums text-ink">
        {note ?? fmt.format(value)}
      </span>
    </li>
  );
}

export type Segment = { key: string; label: string; value: number; colour: string };

/** A 100% stacked bar (support scale, reactions). Segments sweep in left to right. */
export function StackedRow({ label, segments, trailing, index = 0 }: { label: string; segments: Segment[]; trailing?: string; index?: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const summary = segments.map((s) => `${s.label} ${s.value}`).join(", ");
  return (
    <li ref={ref} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 py-1.5">
      <span className="min-w-0 text-[0.82rem] leading-snug text-ink/80">{label}</span>
      <motion.span
        role="img"
        aria-label={`${label}: ${summary}`}
        className="flex h-5 origin-left overflow-hidden rounded-[3px] bg-ink/5"
        initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
        animate={inView || reduce ? { clipPath: "inset(0 0% 0 0)" } : undefined}
        transition={{ duration: 1, ease: EASE_OUT, delay: 0.06 * index }}
      >
        {total > 0 &&
          segments.map((s) =>
            s.value > 0 ? (
              <span
                key={s.key}
                title={`${s.label}: ${fmt.format(s.value)} (${Math.round((100 * s.value) / total)}%)`}
                className="h-full border-r border-white/70 last:border-r-0"
                style={{ width: `${(100 * s.value) / total}%`, backgroundColor: s.colour }}
              />
            ) : null,
          )}
      </motion.span>
      <span className="min-w-[3rem] text-right text-[0.8rem] tabular-nums text-ink">{trailing ?? fmt.format(total)}</span>
    </li>
  );
}

export function Legend({ items }: { items: { label: string; colour: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[0.72rem] text-ink/65">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-[2px] border border-ink/10"
            style={{ backgroundColor: item.colour }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Responses per day as an area chart. The line draws itself in; hover shows the day. */
export function AreaChart({ points }: { points: { date: string; count: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  const W = 800;
  const H = 220;
  const PAD = { l: 34, r: 12, t: 12, b: 26 };

  const shape = useMemo(() => {
    const max = Math.max(1, ...points.map((p) => p.count));
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const x = (i: number) => PAD.l + (points.length > 1 ? (i / (points.length - 1)) * (W - PAD.l - PAD.r) : (W - PAD.l - PAD.r) / 2);
    const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(" ");
    const area = points.length ? `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";
    const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
    const every = Math.max(1, Math.ceil(points.length / 7));
    const labels = points.map((p, i) => ({ i, p })).filter(({ i }) => i % every === 0 || i === points.length - 1);
    return { x, y, line, area, ticks, labels };
    // PAD is constant, so only the points matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  if (!points.length) {
    return <p className="py-10 text-center text-[0.85rem] text-ink/55">No responses in this date range.</p>;
  }

  const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const active = hover === null ? null : points[hover];

  return (
    <div ref={ref} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Responses per day, ${day(points[0].date)} to ${day(points[points.length - 1].date)}`}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - box.left) / box.width) * W;
          const ratio = (px - PAD.l) / (W - PAD.l - PAD.r);
          setHover(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8c88" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ff8c88" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {shape.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={shape.y(t)} y2={shape.y(t)} stroke="rgba(19,23,19,0.08)" />
            <text x={PAD.l - 8} y={shape.y(t) + 4} textAnchor="end" fontSize="11" fill="rgba(19,23,19,0.5)">
              {t}
            </text>
          </g>
        ))}
        {shape.labels.map(({ i, p }) => (
          <text
            key={p.date}
            x={shape.x(i)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            fontSize="11"
            fill="rgba(19,23,19,0.5)"
          >
            {day(p.date)}
          </text>
        ))}
        <motion.path
          d={shape.area}
          fill={`url(#${gradientId})`}
          initial={reduce ? false : { opacity: 0 }}
          animate={inView || reduce ? { opacity: 1 } : undefined}
          transition={{ duration: 0.8, delay: 0.9 }}
        />
        <motion.path
          d={shape.line}
          fill="none"
          stroke="#131713"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={inView || reduce ? { pathLength: 1 } : undefined}
          transition={{ duration: 1.6, ease: EASE_OUT }}
        />
        {active && hover !== null && (
          <g>
            <line x1={shape.x(hover)} x2={shape.x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(19,23,19,0.25)" strokeDasharray="3 3" />
            <circle cx={shape.x(hover)} cy={shape.y(active.count)} r="5" fill="#ff8c88" stroke="#131713" strokeWidth="1.5" />
          </g>
        )}
      </svg>
      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-sw bg-ink px-2.5 py-1.5 text-[0.75rem] text-white shadow-lg"
          style={{ left: `${(shape.x(hover) / W) * 100}%`, transform: `translateX(${hover > points.length / 2 ? "-105%" : "5%"})` }}
        >
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-white/60">{day(active.date)}</span>
          <span className="block tabular-nums">
            {fmt.format(active.count)} {active.count === 1 ? "response" : "responses"}
          </span>
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number): number {
  if (raw <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}
