"use client";

import Link from "next/link";
import { motion, useInView, useReducedMotion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronRight, Download, FileText, Inbox, Loader2, MessageSquareText } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { Odometer } from "@/components/ui/odometer";
import { loadDashboard } from "@/lib/actions/dashboard";
import {
  DOWNLOADS,
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
  Results for one scheme, read from WordPress, laid out by importance:
  1. headline numbers, 2. anything waiting on the team, 3. key findings
  (support and themes), 4. the questionnaire as one card (pick a question to
  see every answer), 5. comments on the map, 6. supporting detail.
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
        {/* 1. Headline numbers */}
        <div className={cn("mt-6 grid grid-cols-2 gap-3 md:grid-cols-4", s.signups !== null && "xl:grid-cols-5")}>
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
          />
          <Tile label="Quick reactions" value={s.reactions} colour="bg-lilac" index={3} />
          {s.signups !== null && (
            <Tile
              label="Signed up for updates"
              value={s.signups}
              colour="bg-yellow"
              index={4}
              className="col-span-2 md:col-span-4 xl:col-span-1"
            />
          )}
        </div>

        {/* 2. Anything waiting on the team */}
        {s.pending_comments > 0 && (
          <Reveal>
            <Link
              href={`${base}/moderate`}
              className="mt-3 flex items-center gap-3 rounded-sw border border-coral bg-coral/15 px-4 py-3 text-[0.88rem] text-ink transition-colors hover:bg-coral/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-coral">
                <Inbox className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="font-medium">
                  {fmt.format(s.pending_comments)} {s.pending_comments === 1 ? "comment" : "comments"} waiting for review
                </span>
                <span className="hidden text-ink/65 sm:inline"> before they show on the site</span>
              </span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium">
                Review
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
          </Reveal>
        )}

        {/* 3. Key findings */}
        <SectionHeading>Key findings</SectionHeading>
        <div className="grid gap-3 lg:grid-cols-3">
          {showSupport ? (
            <SupportCard data={data} className="lg:col-span-2" />
          ) : (
            <TimelineCard data={data} className="lg:col-span-2" />
          )}
          <Card
            title="Themes"
            sub="What written answers and comments are about"
            table={<DataTable head={["Theme", "Mentions"]} rows={data.themes.map((t) => [t.label, t.count])} />}
          >
            <ThemeBars data={data} />
          </Card>
        </div>

        {/* 4. The questionnaire, one card */}
        <SectionHeading>Questionnaire</SectionHeading>
        <QuestionnaireCard questions={data.questionnaire} />

        {/* 5. Comments on the map */}
        <SectionHeading>{data.site.place === "plan" ? "Comments on the plan" : "Comments on the map"}</SectionHeading>
        <CommentsMap data={data} base={base} />

        {/* 6. Supporting detail */}
        <SectionHeading>More detail</SectionHeading>
        <div className={cn("grid gap-3 lg:grid-cols-2", showSupport && "xl:grid-cols-3")}>
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
          {showSupport && <TimelineCard data={data} className="lg:col-span-2 xl:col-span-1" />}
        </div>

        <p className="mt-8 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/45">
          Example data. Answers come from the scheme&apos;s questionnaire in WordPress and update as people respond.
        </p>
      </div>
    </div>
  );
}

function SupportCard({ data, className }: { data: DashboardData; className?: string }) {
  const keys = Object.keys(data.support.scale) as ScaleKey[];
  return (
    <Card
      className={className}
      title="Support by proposal"
      sub="From strongly oppose to strongly support, with the net score"
      table={
        <DataTable
          head={["Proposal", ...Object.values(data.support.scale), "Total"]}
          rows={data.support.proposals.map((p) => [p.label, ...keys.map((k) => p.counts[k]), p.total])}
        />
      }
    >
      <Legend items={keys.map((k) => ({ label: data.support.scale[k], colour: SCALE_COLOURS[k] }))} />
      <ul>
        {data.support.proposals.map((p, i) => (
          <StackedRow
            key={p.key}
            index={i}
            label={p.label}
            trailing={`${p.net > 0 ? "+" : ""}${p.net}`}
            segments={keys.map((k) => ({ key: k, label: data.support.scale[k], value: p.counts[k], colour: SCALE_COLOURS[k] }))}
          />
        ))}
      </ul>
    </Card>
  );
}

function TimelineCard({ data, className }: { data: DashboardData; className?: string }) {
  return (
    <Card
      className={className}
      title="Responses over time"
      sub="Questionnaires sent each day"
      table={<DataTable head={["Day", "Responses"]} rows={data.timeline.map((p) => [p.date, p.count])} />}
    >
      <AreaChart points={data.timeline} />
    </Card>
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
  const items = DOWNLOADS;
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
            className="absolute right-0 z-30 mt-1.5 w-64 origin-top-right rounded-sw border border-ink/10 bg-white p-1 shadow-[0_18px_40px_-20px_rgba(19,23,19,0.45)]"
          >
            {items.map((item) => (
              <li key={item.type}>
                <a
                  href={`${base}/export/${item.type}${query(range)}`}
                  download
                  onClick={() => setOpen(false)}
                  className="block rounded-[3px] px-2.5 py-2 text-[0.85rem] text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <span className="block">{item.label}</span>
                  <span className="block text-[0.72rem] text-ink/50">{item.note}</span>
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
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  colour: string;
  index: number;
  footer?: React.ReactNode;
  className?: string;
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
      className={cn("flex min-h-[7rem] flex-col justify-between rounded-sw p-4", colour, className)}
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/65">{label}</p>
      <div>
        <p className="font-medium leading-none tracking-[-0.03em] text-ink">
          <Odometer value={value} size={36} run={inView || !!reduce} suffix={suffix} delay={0.15 + 0.06 * index} />
        </p>
        {footer && <p className="mt-2 text-[0.78rem] text-ink/70">{footer}</p>}
      </div>
    </motion.div>
  );
}

/** The answer most people gave, for the one-line summary in the list. */
function topAnswer(q: Question): { label: string; pct: number | null } {
  if (q.type === "text") return { label: `${fmt.format(q.notes)} written answers`, pct: null };
  if (q.total === 0 || !q.choices.length) return { label: "No answers yet", pct: null };
  const top = q.choices.reduce((best, c) => (c.count > best.count ? c : best));
  return { label: top.label, pct: top.pct };
}

function answered(q: Question): number {
  return q.type === "text" ? q.notes : q.total;
}

const NARROW = "(max-width: 1023px)";

/** "Question 1A" to "Q1A", so the list column stays narrow. */
function shortCode(q: Question, index: number): string {
  return q.code ? q.code.replace(/^question\s*/i, "Q") : `Q${index + 1}`;
}

/*
  Every question in one card. Each row gives the question and its top answer;
  selecting a row shows all its answers and comments. On wide screens the
  detail sits beside the list, on narrow screens it opens under the row.
*/
function QuestionnaireCard({ questions }: { questions: Question[] }) {
  const [openKey, setOpenKey] = useState<string | null>(questions[0]?.key ?? null);
  const headingId = useId();
  const detailId = useId();
  const open = questions.find((q) => q.key === openKey) ?? null;
  const shown = open ?? questions[0] ?? null;

  const opinion = questions.filter((q) => !q.demographic);
  const about = questions.filter((q) => q.demographic);
  const groups: [string, Question[]][] =
    opinion.length && about.length
      ? [
          ["Views on the plans", opinion],
          ["About you", about],
        ]
      : [["", questions]];

  function pick(key: string) {
    const narrow = window.matchMedia(NARROW).matches;
    setOpenKey((current) => (narrow && current === key ? null : key));
  }

  if (!questions.length) {
    return (
      <Card title="Questionnaire">
        <Empty>This scheme has no questionnaire yet.</Empty>
      </Card>
    );
  }

  return (
    <Reveal>
      <section aria-labelledby={headingId} className="overflow-hidden rounded-sw border border-ink/10 bg-white">
        <header className="border-b border-ink/10 px-4 py-3.5 md:px-5">
          <h2 id={headingId} className="text-[1.05rem] font-medium leading-tight tracking-[-0.01em] text-ink">
            {questions.length} questions
          </h2>
          <p className="mt-1 text-[0.78rem] text-ink/55">
            The top answer for each. Select a question to see every answer and comment.
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div className="lg:max-h-[40rem] lg:overflow-y-auto lg:border-r lg:border-ink/10">
            {groups.map(([label, list]) => (
              <div key={label || "all"}>
                {label && (
                  <p className="sticky top-0 z-10 border-b border-ink/5 bg-white/95 px-4 pb-1.5 pt-3 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-ink/45 backdrop-blur md:px-5">
                    {label}
                  </p>
                )}
                <ul className="divide-y divide-ink/[0.07]">
                  {list.map((q) => {
                    const top = topAnswer(q);
                    const here = open?.key === q.key;
                    const active = shown?.key === q.key;
                    return (
                      <li key={q.key}>
                        <button
                          type="button"
                          aria-expanded={here}
                          aria-controls={detailId}
                          onClick={() => pick(q.key)}
                          className={cn(
                            "relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 md:px-5",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink",
                            active ? "lg:bg-paper" : "hover:bg-paper/60",
                            here && "bg-paper/60",
                          )}
                        >
                          {active && (
                            <span aria-hidden="true" className="absolute inset-y-0 left-0 hidden w-0.5 bg-ink lg:block" />
                          )}
                          <span className="mt-[0.2rem] w-8 shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.06em] text-ink/45">
                            {shortCode(q, questions.indexOf(q))}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block text-[0.88rem] leading-snug text-ink", !here && "line-clamp-2")}>
                              {q.text}
                            </span>
                            <span className="mt-1.5 flex items-center gap-2 text-[0.76rem] text-ink/60">
                              {top.pct !== null && (
                                <span aria-hidden="true" className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-ink/10">
                                  <span className="block h-full rounded-full bg-ink" style={{ width: `${top.pct}%` }} />
                                </span>
                              )}
                              <span className="truncate">
                                {top.pct !== null && <span className="font-medium text-ink">{top.pct}% </span>}
                                {top.label}
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[0.92rem] font-medium tabular-nums text-ink">
                              {fmt.format(answered(q))}
                            </span>
                            <span className="block font-mono text-[0.52rem] uppercase tracking-[0.1em] text-ink/45">answers</span>
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            className={cn(
                              "mt-0.5 size-4 shrink-0 transition-transform duration-200",
                              here ? "rotate-90 text-ink lg:rotate-0" : "text-ink/30",
                            )}
                          />
                        </button>
                        {here && (
                          <div className="border-t border-ink/10 bg-paper/40 px-4 py-4 md:px-5 lg:hidden">
                            <QuestionDetail key={q.key} question={q} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div id={detailId} aria-live="polite" className="hidden lg:block">
            {shown && (
              <motion.div
                key={shown.key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="p-5 xl:p-6"
              >
                <QuestionDetail question={shown} wide />
              </motion.div>
            )}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function QuestionDetail({ question: q, wide = false }: { question: Question; wide?: boolean }) {
  const [asTable, setAsTable] = useState(false);
  const kind = q.kind === "ranking" ? "Ranked first" : q.kind === "multi" ? "Could choose more than one" : undefined;
  const max = Math.max(1, ...q.choices.map((c) => c.count));
  const hasChart = q.type === "choice" && q.total > 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ink/50">
          {[q.code, kind, `${fmt.format(answered(q))} answered`].filter(Boolean).join(" · ")}
        </p>
        {hasChart && (
          <button
            type="button"
            aria-pressed={asTable}
            onClick={() => setAsTable((v) => !v)}
            className="rounded-[3px] border border-ink/15 px-2 py-0.5 text-[0.72rem] text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
          >
            {asTable ? "Chart" : "Table"}
          </button>
        )}
      </div>
      {wide && <h3 className="mt-2 text-[1.15rem] font-medium leading-snug tracking-[-0.01em] text-ink">{q.text}</h3>}
      {q.hint && <p className="mt-1 text-[0.8rem] text-ink/55">{q.hint}</p>}

      <div className="mt-4">
        {q.type === "text" ? (
          q.latest.length ? (
            <Quotes items={q.latest} />
          ) : (
            <Empty>No written answers in this date range.</Empty>
          )
        ) : !hasChart ? (
          <Empty>No answers in this date range.</Empty>
        ) : asTable ? (
          <DataTable head={["Answer", "People", "Share"]} rows={q.choices.map((c) => [c.label, c.count, `${c.pct}%`])} />
        ) : (
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
        )}

        {q.type === "choice" && q.notes > 0 && (
          <div className="mt-4 border-t border-ink/10 pt-3">
            <p className="flex items-center gap-1.5 text-[0.8rem] text-ink/65">
              <MessageSquareText className="size-3.5" aria-hidden="true" />
              {fmt.format(q.notes)} added a comment
            </p>
            <Quotes items={q.latest} />
          </div>
        )}
      </div>
    </div>
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
