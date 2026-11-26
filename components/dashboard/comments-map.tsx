"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LiveMap, glass, type MapLabel, type OverlayImage, type Pin } from "@/components/map/live-map";
import type { Comment, DashboardData } from "@/lib/consultation";
import { pad, planBounds, planPoint } from "@/lib/geo";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Reveal, fmt } from "./charts";

/*
  Every published comment on a real street map. On a masterplan scheme the
  drawing sits on the streets at the scheme's location, with its layers
  switchable, so people's comments can be read against both.
*/

const TONE_LABEL = { neg: "Concern", pos: "Positive", "": "Comment" } as const;

export function CommentsMap({ data, base }: { data: DashboardData; base: string }) {
  const [theme, setTheme] = useState("");
  const [hover, setHover] = useState<Pin["id"] | null>(null);
  const [selected, setSelected] = useState<Pin["id"] | null>(null);
  const [mode, setMode] = useState<"pins" | "heat">("pins");
  const [planOn, setPlanOn] = useState(false);
  const [opacity, setOpacity] = useState(0.85);
  const [layersOn, setLayersOn] = useState<boolean[]>(() => (data.plan?.layers ?? []).map((l) => l.on));
  const listRef = useRef<HTMLUListElement>(null);

  /* The glass list covers the left of the map on wider screens; keep pins clear of it. */
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const plan = data.site.place === "plan" ? data.plan : null;
  const bounds = useMemo(
    () => (plan ? planBounds(data.site.centre, plan.width, plan.height) : undefined),
    [plan, data.site.centre],
  );

  const published = useMemo(() => data.comments.filter((c) => c.status === "approved"), [data.comments]);
  const comments = useMemo(() => published.filter((c) => !theme || c.theme === theme), [published, theme]);

  const themes = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    published.forEach((c) => {
      if (!c.theme) return;
      const entry = counts.get(c.theme) ?? { label: c.themeLabel || data.themeLabels[c.theme] || c.theme, count: 0 };
      entry.count++;
      counts.set(c.theme, entry);
    });
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [published, data.themeLabels]);

  const pins = useMemo<Pin[]>(
    () =>
      comments.map((c) => {
        const [lng, lat] = c.place === "plan" && bounds ? planPoint(bounds, c.lng, c.lat) : [c.lng, c.lat];
        return { id: c.id, lng, lat, tone: c.sentiment, label: c.body };
      }),
    [comments, bounds],
  );

  const overlay = useMemo(() => {
    if (!plan || !bounds) return undefined;
    const images: OverlayImage[] = [
      { key: "base", url: `${base}/plan/base`, visible: planOn },
      ...plan.layers.map((_, i) => ({ key: `layer-${i}`, url: `${base}/plan/${i}`, visible: planOn && !!layersOn[i] })),
    ];
    return { images, bounds, aspect: plan.height / plan.width || 2 / 3 };
  }, [plan, bounds, base, planOn, layersOn]);

  const labels = useMemo<MapLabel[]>(
    () => (plan?.points && bounds ? plan.points.map((pt) => {
      const [lng, lat] = planPoint(bounds, pt.x, pt.y);
      return { key: pt.title, lng, lat, text: pt.title };
    }) : []),
    [plan, bounds],
  );

  const fit = useMemo(() => {
    if (bounds) return pad(bounds, 0.08);
    if (!pins.length) return undefined;
    const lngs = pins.map((p) => p.lng);
    const lats = pins.map((p) => p.lat);
    return pad({ west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) }, 0.2);
  }, [bounds, pins]);

  /* Keep the selected comment in view in the list. */
  useEffect(() => {
    if (selected === null) return;
    listRef.current?.querySelector(`[data-id="${selected}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const active = hover ?? selected;
  const chosen = comments.find((c) => c.id === selected);

  return (
    <Reveal>
      <section aria-labelledby="comments-map-title" className="overflow-hidden rounded-sw border border-ink/10 bg-white">
        <LiveMap
          className="h-[min(46rem,82svh)] min-h-[34rem]"
          centre={data.site.centre}
          zoom={16}
          pins={pins}
          area={bounds}
          labels={labels}
          overlay={overlay}
          overlayOpacity={opacity}
          fit={fit}
          activeId={active}
          focusId={selected}
          onHover={setHover}
          onSelect={setSelected}
          mode={mode}
          padding={wide ? { left: 400, right: 70, top: 30, bottom: 40 } : { top: 20, right: 60, bottom: 20, left: 20 }}
        >
          {/* Comment list */}
          <div className={cn(glass, "absolute bottom-3 left-3 top-3 z-10 hidden w-[23rem] flex-col md:flex")}>
            <div className="border-b border-ink/10 p-4">
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ink/55">
                {plan ? "Comments on the masterplan" : "Comments on the map"}
              </p>
              <h2 id="comments-map-title" className="mt-1 text-[1.25rem] font-medium leading-tight tracking-[-0.02em] text-ink">
                {fmt.format(comments.length)} {comments.length === 1 ? "comment" : "comments"}
                {theme && <span className="text-ink/50"> on {themes.find(([k]) => k === theme)?.[1].label}</span>}
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by theme">
                <Chip on={!theme} onClick={() => setTheme("")}>
                  All
                </Chip>
                {themes.map(([key, t]) => (
                  <Chip key={key} on={theme === key} onClick={() => setTheme(theme === key ? "" : key)}>
                    {t.label} <span className="text-current/60 tabular-nums">{t.count}</span>
                  </Chip>
                ))}
              </div>
            </div>
            <ul ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {comments.length === 0 && (
                <li className="px-3 py-8 text-center text-[0.85rem] text-ink/55">No comments for this theme.</li>
              )}
              {comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  active={active === c.id}
                  onHover={setHover}
                  onSelect={() => setSelected(selected === c.id ? null : c.id)}
                />
              ))}
            </ul>
            {data.summary.pending_comments > 0 && (
              <Link
                href={`${base}/moderate`}
                className="border-t border-ink/10 px-4 py-3 text-[0.8rem] text-ink/70 transition-colors hover:bg-white/60 hover:text-ink"
              >
                {fmt.format(data.summary.pending_comments)} more waiting for review →
              </Link>
            )}
          </div>

          {/* Selected comment, on narrow screens where the list is below */}
          <AnimatePresence>
            {chosen && (
              <motion.div
                key={chosen.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className={cn(glass, "absolute inset-x-3 top-3 z-10 p-4 md:hidden")}
              >
                <CommentMeta comment={chosen} />
                <p className="mt-1 text-[0.92rem] leading-snug text-ink">{chosen.body}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* View options and key */}
          <div className={cn(glass, "absolute bottom-3 right-3 z-10 w-[15.5rem] p-3")}>
            <div role="group" aria-label="Show comments as" className="grid grid-cols-2 gap-0.5 rounded-lg bg-ink/5 p-0.5">
              {(
                [
                  ["pins", "Pins", MapPin],
                  ["heat", "Heat", Flame],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={mode === key}
                  onClick={() => setMode(key)}
                  className={cn(
                    "relative flex h-7 items-center justify-center gap-1 rounded-md text-[0.75rem] transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
                    mode === key ? "text-ink" : "text-ink/55 hover:text-ink",
                  )}
                >
                  {mode === key && (
                    <motion.span
                      layoutId="map-mode"
                      aria-hidden="true"
                      className="absolute inset-0 rounded-md bg-white shadow-sm"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <Icon className="relative size-3.5" aria-hidden="true" />
                  <span className="relative">{label}</span>
                </button>
              ))}
            </div>

            <ul className="mt-3 space-y-1 text-[0.75rem] text-ink/75">
              {(["neg", "pos", ""] as const).map((tone) => (
                <li key={tone} className="flex items-center gap-2">
                  <ToneDot tone={tone} />
                  {TONE_LABEL[tone]}
                  <span className="ml-auto tabular-nums text-ink/50">
                    {fmt.format(comments.filter((c) => c.sentiment === tone).length)}
                  </span>
                </li>
              ))}
            </ul>

            {plan && (
              <div className="mt-3 border-t border-ink/10 pt-3">
                <Toggle on={planOn} onChange={setPlanOn} label="Plan drawing" />
                {planOn && (
                  <>
                    <label className="mt-2 flex items-center gap-2 text-[0.7rem] text-ink/60">
                      Opacity
                      <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={opacity}
                        onChange={(event) => setOpacity(Number(event.target.value))}
                        className="h-1 flex-1 accent-ink"
                      />
                    </label>
                    <ul className="mt-2 space-y-1">
                      {plan.layers.map((layer, i) => (
                        <li key={layer.url}>
                          <Toggle
                            small
                            on={!!layersOn[i]}
                            onChange={(on) => setLayersOn((list) => list.map((v, j) => (j === i ? on : v)))}
                            label={layer.label}
                            swatch={layer.colour}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </LiveMap>

        {/* Narrow screens: the list sits under the map */}
        <ul className="max-h-[24rem] space-y-1 overflow-y-auto border-t border-ink/10 p-2 md:hidden">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              active={active === c.id}
              onHover={setHover}
              onSelect={() => setSelected(selected === c.id ? null : c.id)}
            />
          ))}
        </ul>
      </section>
    </Reveal>
  );
}

function CommentRow({
  comment: c,
  active,
  onHover,
  onSelect,
}: {
  comment: Comment;
  active: boolean;
  onHover: (id: number | null) => void;
  onSelect: () => void;
}) {
  return (
    <li data-id={c.id}>
      <button
        type="button"
        onMouseEnter={() => onHover(c.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(c.id)}
        onBlur={() => onHover(null)}
        onClick={onSelect}
        aria-pressed={active}
        className={cn(
          "w-full rounded-lg px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-200",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink",
          active ? "bg-white shadow-[0_6px_18px_-10px_rgba(19,23,19,0.4)]" : "hover:bg-white/60",
        )}
      >
        <CommentMeta comment={c} />
        <span className="mt-1 block text-[0.86rem] leading-snug text-ink">{c.body}</span>
      </button>
    </li>
  );
}

function CommentMeta({ comment: c }: { comment: Comment }) {
  const date = new Date(`${c.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <span className="flex items-center gap-2 font-mono text-[0.56rem] uppercase tracking-[0.1em] text-ink/55">
      <ToneDot tone={c.sentiment} />
      {c.themeLabel || "No theme"}
      <span className="ml-auto normal-case tracking-normal">{date}</span>
    </span>
  );
}

function ToneDot({ tone }: { tone: Comment["sentiment"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2.5 shrink-0 rounded-full border-2 border-white shadow-[0_1px_3px_rgba(19,23,19,0.4)]",
        tone === "neg" ? "bg-coral" : tone === "pos" ? "bg-olive" : "bg-ink",
      )}
    />
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[0.72rem] transition-colors duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
        on ? "bg-ink text-white" : "bg-white/70 text-ink/75 hover:bg-white hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({
  on,
  onChange,
  label,
  swatch,
  small,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  swatch?: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md text-left text-ink transition-opacity",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
        small ? "text-[0.72rem]" : "text-[0.78rem] font-medium",
        !on && "opacity-55",
      )}
    >
      {swatch && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: swatch }} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200",
          on ? "bg-ink" : "bg-ink/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-white shadow transition-[left] duration-200",
            on ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
