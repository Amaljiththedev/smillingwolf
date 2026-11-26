"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, MapPin, Search, Undo2, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { updateComment } from "@/lib/actions/dashboard";
import type { Comment } from "@/lib/consultation";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Reveal, fmt } from "./charts";

/*
  Comments left on the plan wait here until someone approves them. Approving
  publishes the comment on the scheme site; rejecting hides it. The theme can
  be corrected at the same time. Every change is saved straight to WordPress.

  The list is filtered (status, search, theme), sorted and split into pages,
  all in the browser: a scheme has hundreds of comments, not millions.
*/

const TABS: { key: Comment["status"]; label: string; hint: string }[] = [
  { key: "pending", label: "Waiting", hint: "Not on the site yet" },
  { key: "approved", label: "Approved", hint: "Showing on the site" },
  { key: "rejected", label: "Rejected", hint: "Hidden from the site" },
];

const PAGE_SIZES = [10, 20, 50] as const;

const SENTIMENT = {
  neg: { label: "Concern", dot: "bg-coral", chip: "bg-coral/20" },
  pos: { label: "Positive", dot: "bg-olive", chip: "bg-lime/70" },
  "": { label: "Comment", dot: "bg-white", chip: "bg-ink/5" },
} as const;

/** Page numbers to show, with gaps: 1 … 4 5 6 … 12 */
function pageList(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Moderation({
  siteId,
  name,
  initial,
  themeLabels,
  note,
}: {
  siteId: string;
  name: string;
  initial: Comment[];
  themeLabels: Record<string, string>;
  note?: string | null;
}) {
  const [comments, setComments] = useState(initial);
  const [tab, setTab] = useState<Comment["status"]>("pending");
  const [search, setSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const listTop = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    comments.forEach((comment) => c[comment.status]++);
    return c;
  }, [comments]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = comments.filter(
      (c) =>
        c.status === tab &&
        (themeFilter === "all" || c.theme === themeFilter) &&
        (!needle || c.body.toLowerCase().includes(needle) || c.topic.toLowerCase().includes(needle)),
    );
    /* Dates come as Y-m-d (or Y-m-d H:i), so text order is date order. Ties keep WordPress's order. */
    return list.sort((a, b) => (newestFirst ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || a.id - b.id);
  }, [comments, tab, search, themeFilter, newestFirst]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  /* Approving the last comment on the last page shrinks the list; stay on a page that exists. */
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const shown = filtered.slice(start, start + pageSize);
  const filtering = search.trim() !== "" || themeFilter !== "all";

  function goTo(next: number) {
    setPage(Math.max(1, Math.min(next, pageCount)));
    listTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetPage<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  }

  function change(comment: Comment, patch: { status?: Comment["status"]; theme?: string }) {
    const before = comments;
    setBusy(comment.id);
    setError(null);
    /* Optimistic: move the row now, put it back if WordPress says no. */
    setComments((list) =>
      list.map((c) =>
        c.id === comment.id
          ? {
              ...c,
              ...patch,
              themeLabel: patch.theme !== undefined ? (themeLabels[patch.theme] ?? "") : c.themeLabel,
            }
          : c,
      ),
    );
    startTransition(async () => {
      const result = await updateComment(siteId, comment.id, patch);
      setBusy(null);
      if (!result.ok) {
        setComments(before);
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-[64rem] px-4 pb-24 pt-8 min-[810px]:px-6 lg:pt-12">
      <Reveal>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/55">{name}</p>
        <h1 className="mt-2 text-[clamp(1.9rem,3.6vw,3rem)] font-medium leading-[1.02] tracking-[-0.03em] text-ink">
          Moderation
        </h1>
        <p className="mt-3 max-w-[38rem] text-[0.95rem] text-ink/70">
          Comments on the plan appear on the scheme site once approved. Check each one, fix its theme if needed, then
          approve or reject it.
        </p>
        {note && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-1 text-[0.78rem] text-ink/65">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-yellow ring-1 ring-ink/20" />
            {note}
          </p>
        )}
      </Reveal>

      {/* Status: three cards that double as tabs */}
      <Reveal delay={0.06}>
        <div role="tablist" aria-label="Comment status" className="mt-8 grid grid-cols-3 gap-2 md:gap-3">
          {TABS.map((t) => {
            const active = tab === t.key;
            const alert = t.key === "pending" && counts.pending > 0;
            return (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => resetPage(setTab)(t.key)}
                className={cn(
                  "relative flex flex-col items-start gap-2 rounded-sw border p-3 text-left transition-[border-color,background-color,box-shadow] duration-200 md:p-4",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  active
                    ? "border-ink bg-white shadow-[0_14px_30px_-22px_rgba(19,23,19,0.5)]"
                    : "border-ink/10 bg-white/60 hover:border-ink/25 hover:bg-white",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/60">{t.label}</span>
                  {alert && <span aria-hidden="true" className="size-2 rounded-full bg-coral" />}
                </span>
                <span className="text-[clamp(1.5rem,3vw,2.1rem)] font-medium leading-none tracking-[-0.03em] tabular-nums text-ink">
                  {fmt.format(counts[t.key])}
                </span>
                <span className="hidden text-[0.75rem] text-ink/55 sm:block">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </Reveal>

      {/* Search, theme, sort */}
      <div ref={listTop} className="mt-6 flex scroll-mt-20 flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1">
          <span className="sr-only">Search comments</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink/45" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => resetPage(setSearch)(event.target.value)}
            placeholder="Search comments"
            className="h-9 w-full rounded-sw border border-ink/15 bg-white pl-8 pr-3 text-[0.85rem] text-ink placeholder:text-ink/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
          />
        </label>
        <label className="flex items-center">
          <span className="sr-only">Filter by theme</span>
          <select
            value={themeFilter}
            onChange={(event) => resetPage(setThemeFilter)(event.target.value)}
            className="h-9 rounded-sw border border-ink/15 bg-white px-2 text-[0.82rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
          >
            <option value="all">All themes</option>
            {Object.entries(themeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
            <option value="">No theme</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => resetPage(setNewestFirst)(!newestFirst)}
          className="h-9 rounded-sw border border-ink/15 bg-white px-3 text-[0.82rem] text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
        >
          {newestFirst ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-sw border border-coral bg-coral/15 px-3 py-2 text-[0.85rem] text-ink">
          {error}
        </p>
      )}

      <p aria-live="polite" className="mt-4 flex items-center justify-between gap-3 text-[0.8rem] text-ink/60">
        <span>
          {filtered.length === 0
            ? "No comments"
            : `Showing ${fmt.format(start + 1)} to ${fmt.format(start + shown.length)} of ${fmt.format(filtered.length)}`}
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setThemeFilter("all");
                setPage(1);
              }}
              className="ml-2 underline decoration-ink/30 underline-offset-2 hover:text-ink hover:decoration-ink"
            >
              Clear filters
            </button>
          )}
        </span>
        <label className="flex items-center gap-1.5">
          Per page
          <select
            value={pageSize}
            onChange={(event) => resetPage(setPageSize)(Number(event.target.value))}
            className="h-7 rounded-sw border border-ink/15 bg-white px-1.5 text-[0.78rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </p>

      <ul className="mt-2 space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.length === 0 && (
            <motion.li
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-sw border border-dashed border-ink/15 bg-white/50 py-14 text-center text-[0.9rem] text-ink/55"
            >
              {filtering
                ? "No comments match. Try another search or theme."
                : tab === "pending"
                  ? "Nothing waiting. Every comment has been checked."
                  : "No comments here yet."}
            </motion.li>
          )}
          {shown.map((c, i) => {
            const mood = SENTIMENT[c.sentiment] ?? SENTIMENT[""];
            return (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT, delay: Math.min(i, 10) * 0.025 } }}
                exit={{ opacity: 0, x: c.status === "approved" ? 40 : -40, transition: { duration: 0.22 } }}
                className={cn(
                  "rounded-sw border border-ink/10 bg-white p-4 transition-shadow duration-300 hover:shadow-[0_12px_30px_-22px_rgba(19,23,19,0.45)] md:p-5",
                  busy === c.id && "opacity-70",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] text-ink", mood.chip)}>
                    <span aria-hidden="true" className={cn("size-1.5 rounded-full border border-ink/40", mood.dot)} />
                    {mood.label}
                  </span>
                  {c.topic && <span className="text-[0.78rem] font-medium text-ink">{c.topic}</span>}
                  <span className="inline-flex items-center gap-1 text-[0.74rem] text-ink/50">
                    <MapPin className="size-3" aria-hidden="true" />
                    {c.place === "plan" ? "On the plan" : "On the map"}
                  </span>
                  <span className="ml-auto font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/50">{c.date}</span>
                </div>

                <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink">{c.body}</p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/[0.07] pt-3">
                  <label className="flex items-center gap-2 text-[0.78rem] text-ink/60">
                    Theme
                    <select
                      value={c.theme}
                      onChange={(event) => change(c, { theme: event.target.value })}
                      className="h-8 max-w-[12rem] rounded-sw border border-ink/15 bg-white px-2 text-[0.8rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
                    >
                      <option value="">No theme</option>
                      {Object.entries(themeLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex gap-1.5">
                    {c.status !== "pending" && (
                      <ActionButton tone="plain" onClick={() => change(c, { status: "pending" })} disabled={busy === c.id}>
                        <Undo2 className="size-3.5" aria-hidden="true" /> Back to waiting
                      </ActionButton>
                    )}
                    {c.status !== "rejected" && (
                      <ActionButton tone="reject" onClick={() => change(c, { status: "rejected" })} disabled={busy === c.id}>
                        <X className="size-3.5" aria-hidden="true" /> Reject
                      </ActionButton>
                    )}
                    {c.status !== "approved" && (
                      <ActionButton tone="approve" onClick={() => change(c, { status: "approved" })} disabled={busy === c.id}>
                        <Check className="size-3.5" aria-hidden="true" /> Approve
                      </ActionButton>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {pageCount > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-2">
          <PageButton onClick={() => goTo(current - 1)} disabled={current === 1} label="Previous page">
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </PageButton>

          <ol className="hidden items-center gap-1 sm:flex">
            {pageList(current, pageCount).map((p, i) =>
              p === "gap" ? (
                <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-[0.8rem] text-ink/40">
                  …
                </li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => goTo(p)}
                    aria-current={p === current ? "page" : undefined}
                    aria-label={`Page ${p}`}
                    className={cn(
                      "grid size-9 place-items-center rounded-sw text-[0.85rem] tabular-nums transition-colors duration-150",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                      p === current ? "bg-ink text-white" : "text-ink/70 hover:bg-white hover:text-ink",
                    )}
                  >
                    {p}
                  </button>
                </li>
              ),
            )}
          </ol>
          <span className="text-[0.82rem] tabular-nums text-ink/60 sm:hidden">
            Page {current} of {pageCount}
          </span>

          <PageButton onClick={() => goTo(current + 1)} disabled={current === pageCount} label="Next page">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </PageButton>
        </nav>
      )}
    </div>
  );
}

function PageButton({
  label,
  children,
  ...props
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      {...props}
      className="inline-flex h-9 items-center gap-1 rounded-sw border border-ink/15 bg-white px-3 text-[0.85rem] text-ink transition-colors duration-150 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ActionButton({
  tone,
  children,
  ...props
}: { tone: "approve" | "reject" | "plain" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-sw px-2.5 text-[0.8rem] transition-[background-color,opacity] duration-200 disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        tone === "approve" && "bg-ink text-white hover:opacity-85",
        tone === "reject" && "border border-ink/15 text-ink hover:bg-coral/25",
        tone === "plain" && "border border-ink/15 text-ink/70 hover:bg-ink/5 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
