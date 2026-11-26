"use client";

import Link from "next/link";
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion";
import { Download, FileText, Loader2, MessageSquareText } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Odometer } from "@/components/ui/odometer";
import { loadDashboard } from "@/lib/actions/dashboard";
import {
  REACTION_COLOURS,
  SCALE_COLOURS,
  type DashboardData,
  type Group,
  type Question,
  type Range,
  type ScaleKey,
} from "@/lib/consultation";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { CommentsMap } from "./comments-map";
import { AreaChart, BarRow, Card, DataTable, Legend, Reveal, StackedRow, fmt } from "./charts";

/*
  Results for one scheme, read from WordPress. Same cards as the plugin's own
  dashboard: headline numbers, responses over time, each question, themes,
  comments on the plan, quick reactions and who responded.
*/

type Preset = "all" | "7" | "30" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "all", label: "All" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "custom", label: "Dates" },
];

function isoDay(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function presetRange(preset: Preset): Range {
  if (preset === "all" || preset === "custom") return {};
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (Number(preset) - 1));
  return { from: isoDay(from), to: isoDay(to) };
}

function query(range: Range): string {
  const q = new URLSearchParams();
  if (range.from) q.set("from", range.from);
  if (range.to) q.set("to", range.to);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function Dashboard({ siteId, initial }: { siteId: string; initial: DashboardData }) {
  const [data, setData] = useState(initial);
  const [preset, setPreset] = useState<Preset>("all");
  const [range, setRange] = useState<Range>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(next: Range) {
    setRange(next);
    startTransition(async () => {
      const result = await loadDashboard(siteId, next);
      if (result.ok) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  function choosePreset(next: Preset) {
    setPreset(next);
    if (next !== "custom") load(presetRange(next));
  }

  const base = `/builder/${siteId}`;
  const s = data.summary;
  const showSupport = data.support.proposals.some((p) => p.total > 0);

  return (
    <div className="mx-auto w-full max-w-[90rem] px-4 pb-24 pt-8 min-[810px]:px-6 lg:pt-12">
      {/* Heading and filters */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/55">Consultation results</p>
            <h1 className="mt-2 text-[clamp(1.9rem,3.6vw,3rem)] font-medium leading-[1.02] tracking-[-0.03em] text-ink">
              {data.site.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu base={base} range={range} />
            <Link
              href={`${base}/report${query(range)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-sw bg-ink px-3.5 text-[0.85rem] text-white transition-opacity duration-200 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <FileText className="size-3.5" aria-hidden="true" />
              Report
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-ink/10 py-3">
          <div role="group" aria-label="Date range" className="flex flex-wrap gap-0.5 rounded-sw border border-ink/10 bg-white p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={preset === p.key}
                onClick={() => choosePreset(p.key)}
                className={cn(
                  "relative rounded-[3px] px-2.5 py-1 text-[0.8rem] transition-colors duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  preset === p.key ? "text-white" : "text-ink/65 hover:text-ink",
                )}
              >
                {preset === p.key && (
                  <motion.span
                    layoutId="range-pill"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[3px] bg-ink"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  />
                )}
                <span className="relative">{p.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {preset === "custom" && (
              <motion.form
                key="dates"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  load({ from: String(form.get("from") || "") || undefined, to: String(form.get("to") || "") || undefined });
                }}
              >
                <DateField name="from" label="From" defaultValue={range.from} />
                <DateField name="to" label="To" defaultValue={range.to} />
                <button
                  type="submit"
                  className="h-8 rounded-sw border border-ink/15 px-3 text-[0.8rem] text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Apply
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <span aria-live="polite" className="ml-auto flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/55">
            {pending ? (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Updating
              </>
            ) : range.from || range.to ? (
              `${range.from ?? "start"} to ${range.to ?? "today"}`
            ) : (
              "Everything so far"
            )}
          </span>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-sw border border-coral bg-coral/15 px-3 py-2 text-[0.85rem] text-ink">
            {error}
          </p>
        )}
      </Reveal>

      <div className={cn("transition-opacity duration-300", pending && "opacity-60")}>
        {/* Headline numbers */}
        <div className={cn("mt-8 grid grid-cols-2 gap-3 md:grid-cols-3", s.signups !== null ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
          <Tile label="Responses" value={s.responses} colour="bg-lime" index={0} />
          {s.support_pct !== null ? (
            <Tile label="Support the plans" value={s.support_pct} suffix="%" colour="bg-blue" index={1} />
          ) : (
            <Tile label="Written answers" value={s.written} colour="bg-blue" index={1} />
          )}
          <Tile
            label={data.site.place === "plan" ? "Comments on the plan" : "Map comments"}
            value={s.comments}
            colour="bg-peach"
            index={2}
            footer={
              s.pending_comments > 0 ? (
                <Link href={`${base}/moderate`} className="underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
                  {fmt.format(s.pending_comments)} waiting for review
                </Link>
              ) : (
                "None waiting"
              )
            }
          />
          <Tile label="Quick reactions" value={s.reactions} colour="bg-lilac" index={3} />
          {s.signups !== null && <Tile label="Signed up for updates" value={s.signups} colour="bg-yellow" index={4} />}
        </div>

        {/* Over time */}
        <div className="mt-3">
          <Card
            title="Responses over time"
            sub="Questionnaires sent each day"
            table={<DataTable head={["Day", "Responses"]} rows={data.timeline.map((p) => [p.date, p.count])} />}
          >
            <AreaChart points={data.timeline} />
          </Card>
        </div>

        {/* The questionnaire */}
        <SectionHeading>The questionnaire</SectionHeading>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.questionnaire.map((q, i) => (
            <QuestionCard key={q.key} question={q} delay={(i % 2) * 0.08} />
          ))}
        </div>

        {showSupport && (
          <div className="mt-3">
            <Card
              title="Support by proposal"
              sub="From strongly oppose to strongly support"
              table={
                <DataTable
                  head={["Proposal", ...Object.values(data.support.scale), "Total"]}
                  rows={data.support.proposals.map((p) => [
                    p.label,
                    ...(Object.keys(data.support.scale) as ScaleKey[]).map((k) => p.counts[k]),
                    p.total,
                  ])}
                />
              }
            >
              <Legend items={(Object.keys(data.support.scale) as ScaleKey[]).map((k) => ({ label: data.support.scale[k], colour: SCALE_COLOURS[k] }))} />
              <ul>
                {data.support.proposals.map((p, i) => (
                  <StackedRow
                    key={p.key}
                    index={i}
                    label={p.label}
                    trailing={`${p.net > 0 ? "+" : ""}${p.net}`}
                    segments={(Object.keys(data.support.scale) as ScaleKey[]).map((k) => ({
                      key: k,
                      label: data.support.scale[k],
                      value: p.counts[k],
                      colour: SCALE_COLOURS[k],
                    }))}
                  />
                ))}
              </ul>
            </Card>
          </div>
        )}

        {/* What people said */}
        <SectionHeading>What people said</SectionHeading>
        <CommentsMap data={data} base={base} />

        <div className="mt-3 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          <Card
            title="Themes"
            sub="Written answers and comments, grouped by theme"
            table={<DataTable head={["Theme", "Mentions"]} rows={data.themes.map((t) => [t.label, t.count])} />}
          >
            <ThemeBars data={data} />
          </Card>
          <Card
            title="Quick reactions"
            sub="Like, unsure or dislike on each idea"
            table={
              <DataTable
                head={["Idea", "Like", "Unsure", "Dislike"]}
                rows={data.reactions.map((r) => [r.label, r.like, r.unsure, r.dislike])}
              />
            }
          >
            {data.reactions.length ? (
              <>
                <Legend
                  items={[
                    { label: "Like", colour: REACTION_COLOURS.like },
                    { label: "Unsure", colour: REACTION_COLOURS.unsure },
                    { label: "Dislike", colour: REACTION_COLOURS.dislike },
                  ]}
                />
                <ul>
                  {data.reactions.map((r, i) => {
                    const total = r.like + r.unsure + r.dislike;
                    return (
                      <StackedRow
                        key={r.key}
                        index={i}
                        label={r.label}
                        trailing={total ? `${Math.round((100 * r.like) / total)}% like` : "0"}
                        segments={[
                          { key: "like", label: "Like", value: r.like, colour: REACTION_COLOURS.like },
                          { key: "unsure", label: "Unsure", value: r.unsure, colour: REACTION_COLOURS.unsure },
                          { key: "dislike", label: "Dislike", value: r.dislike, colour: REACTION_COLOURS.dislike },
                        ]}
                      />
                    );
                  })}
                </ul>
              </>
            ) : (
              <Empty>No reactions in this date range.</Empty>
            )}
          </Card>
          <RespondentsCard data={data} />
        </div>

        <p className="mt-8 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/45">
          Example data. Answers come from the scheme&apos;s questionnaire in WordPress and update as people respond.
        </p>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Reveal>
      <h2 className="mb-4 mt-14 flex items-center gap-3 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/55">
        {children}
        <span aria-hidden="true" className="h-px flex-1 bg-ink/10" />
      </h2>
    </Reveal>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-[0.85rem] text-ink/55">{children}</p>;
}

function DateField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="flex items-center gap-1.5 text-[0.8rem] text-ink/65">
      {label}
      <input
        type="date"
        name={name}
        defaultValue={defaultValue}
        className="h-8 rounded-sw border border-ink/15 bg-white px-2 text-[0.8rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
      />
    </label>
  );
}

function ExportMenu({ base, range }: { base: string; range: Range }) {
  const [open, setOpen] = useState(false);
  const items = [
    { type: "responses", label: "Questionnaire answers" },
    { type: "comments", label: "Comments" },
    { type: "reactions", label: "Quick reactions" },
  ];
  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-sw border border-ink/15 bg-white px-3.5 text-[0.85rem] text-ink transition-colors duration-200 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Download className="size-3.5" aria-hidden="true" />
        Download CSV
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="absolute right-0 z-30 mt-1.5 w-56 origin-top-right rounded-sw border border-ink/10 bg-white p-1 shadow-[0_18px_40px_-20px_rgba(19,23,19,0.45)]"
          >
            {items.map((item) => (
              <li key={item.type}>
                <a
                  href={`${base}/export/${item.type}${query(range)}`}
                  download
                  onClick={() => setOpen(false)}
                  className="block rounded-[3px] px-2.5 py-2 text-[0.85rem] text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tile({
  label,
  value,
  suffix,
  colour,
  index,
  footer,
}: {
  label: string;
  value: number;
  suffix?: string;
  colour: string;
  index: number;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 20, scale: 0.97 }}
      animate={inView || reduce ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.06 * index }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={cn("flex min-h-[9.5rem] flex-col justify-between rounded-sw p-4 md:p-5", colour)}
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/65">{label}</p>
      <div>
        <p className="font-medium leading-none tracking-[-0.03em] text-ink">
          <Odometer value={value} size={44} run={inView || !!reduce} suffix={suffix} delay={0.15 + 0.06 * index} />
        </p>
        {footer && <p className="mt-2 text-[0.78rem] text-ink/70">{footer}</p>}
      </div>
    </motion.div>
  );
}

function QuestionCard({ question: q, delay }: { question: Question; delay: number }) {
  const label = q.kind === "ranking" ? "Ranked first" : q.kind === "multi" ? "Could choose more than one" : undefined;
  const max = Math.max(1, ...q.choices.map((c) => c.count));

  return (
    <Card
      delay={delay}
      title={q.text}
      sub={[q.code, label].filter(Boolean).join(" · ")}
      table={
        q.type === "choice" ? (
          <DataTable head={["Answer", "People", "Share"]} rows={q.choices.map((c) => [c.label, c.count, `${c.pct}%`])} />
        ) : undefined
      }
    >
      {q.type === "text" ? (
        <div>
          <p className="text-[0.85rem] text-ink/70">
            <span className="text-[1.6rem] font-medium tracking-[-0.02em] text-ink">{fmt.format(q.notes)}</span> written answers
          </p>
          <Quotes items={q.latest} />
        </div>
      ) : q.total === 0 ? (
        <Empty>No answers in this date range.</Empty>
      ) : (
        <>
          <ul>
            {q.choices.map((c, i) => (
              <BarRow
                key={c.key}
                index={i}
                label={c.label}
                value={c.count}
                max={max}
                note={`${c.pct}% · ${fmt.format(c.count)}`}
                colour={c.count === max ? "#131713" : "#c2c698"}
              />
            ))}
          </ul>
          {q.notes > 0 && (
            <details className="group mt-3 border-t border-ink/10 pt-3">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[0.8rem] text-ink/65 hover:text-ink">
                <MessageSquareText className="size-3.5" aria-hidden="true" />
                {fmt.format(q.notes)} added a comment
                <span className="ml-1 transition-transform duration-200 group-open:rotate-90">›</span>
              </summary>
              <Quotes items={q.latest} />
            </details>
          )}
        </>
      )}
    </Card>
  );
}

function Quotes({ items }: { items: { text: string; theme: string }[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -6 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.05 * i }}
          className="border-l-2 border-peach pl-3 text-[0.85rem] leading-snug text-ink"
        >
          &ldquo;{item.text}&rdquo;
          {item.theme && (
            <span className="mt-0.5 block font-mono text-[0.55rem] uppercase tracking-[0.1em] text-ink/50">{item.theme}</span>
          )}
        </motion.li>
      ))}
    </ul>
  );
}

function ThemeBars({ data }: { data: DashboardData }) {
  const themes = data.themes.filter((t) => t.count > 0);
  if (!themes.length) return <Empty>No themed comments in this date range.</Empty>;
  const max = Math.max(...themes.map((t) => t.count));
  return (
    <ul>
      {themes.map((t, i) => (
        <BarRow key={t.key} index={i} label={t.label} value={t.count} max={max} colour="#ff8c88" />
      ))}
    </ul>
  );
}

const GROUP_TABS = [
  { key: "age_band", label: "Age" },
  { key: "connection", label: "Connection" },
  { key: "postcode", label: "Postcode" },
] as const;

function RespondentsCard({ data }: { data: DashboardData }) {
  const [tab, setTab] = useState<(typeof GROUP_TABS)[number]["key"]>("age_band");
  const groups: Group[] = data.respondents[tab];
  const total = groups.reduce((sum, g) => sum + g.count, 0);
  const max = Math.max(1, ...groups.map((g) => g.count));
  return (
    <Card
      title="Who responded"
      sub="From the questionnaire's about-you questions"
      action={
        <div role="tablist" aria-label="Group by" className="flex gap-0.5 rounded-sw border border-ink/10 p-0.5">
          {GROUP_TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative rounded-[3px] px-2 py-0.5 text-[0.72rem] transition-colors duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
                tab === t.key ? "text-white" : "text-ink/60 hover:text-ink",
              )}
            >
              {tab === t.key && (
                <motion.span
                  layoutId="group-pill"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-[3px] bg-ink"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
      }
      table={<DataTable head={["Group", "People"]} rows={groups.map((g) => [g.label, g.count])} />}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
        >
          {total === 0 ? (
            <Empty>Nobody has answered this yet.</Empty>
          ) : (
            <ul>
              {groups.map((g, i) => (
                <BarRow key={g.key ?? g.label} index={i} label={g.label} value={g.count} max={max} colour="#d9bfff" />
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}
