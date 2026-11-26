"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Undo2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { updateComment } from "@/lib/actions/dashboard";
import type { Comment } from "@/lib/consultation";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Reveal, fmt } from "./charts";

/*
  Comments left on the plan wait here until someone approves them. Approving
  publishes the comment on the scheme site; rejecting hides it. The theme can
  be corrected at the same time. Every change is saved straight to WordPress.
*/

const TABS: { key: Comment["status"]; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export function Moderation({
  siteId,
  name,
  initial,
  themeLabels,
}: {
  siteId: string;
  name: string;
  initial: Comment[];
  themeLabels: Record<string, string>;
}) {
  const [comments, setComments] = useState(initial);
  const [tab, setTab] = useState<Comment["status"]>("pending");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    comments.forEach((comment) => c[comment.status]++);
    return c;
  }, [comments]);

  const shown = comments.filter((c) => c.status === tab);

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
    <div className="mx-auto w-full max-w-[72rem] px-4 pb-24 pt-8 min-[810px]:px-6 lg:pt-12">
      <Reveal>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/55">{name}</p>
        <h1 className="mt-2 text-[clamp(1.9rem,3.6vw,3rem)] font-medium leading-[1.02] tracking-[-0.03em] text-ink">
          Moderation
        </h1>
        <p className="mt-3 max-w-[38rem] text-[0.95rem] text-ink/70">
          Comments on the plan appear on the scheme site once approved. Check each one, fix its theme if needed, then
          approve or reject it.
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <div role="tablist" aria-label="Comment status" className="mt-8 flex gap-1 border-b border-ink/10">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative -mb-px flex items-center gap-2 px-3 pb-3 pt-1 text-[0.9rem] transition-colors duration-200",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                tab === t.key ? "text-ink" : "text-ink/55 hover:text-ink",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-px font-mono text-[0.6rem] tabular-nums",
                  t.key === "pending" && counts.pending > 0 ? "bg-coral text-ink" : "bg-ink/8 text-ink/65",
                )}
              >
                {fmt.format(counts[t.key])}
              </span>
              {tab === t.key && (
                <motion.span
                  layoutId="moderation-tab"
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-ink"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
            </button>
          ))}
        </div>
      </Reveal>

      {error && (
        <p role="alert" className="mt-4 rounded-sw border border-coral bg-coral/15 px-3 py-2 text-[0.85rem] text-ink">
          {error}
        </p>
      )}

      <ul className="mt-4 space-y-2" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.length === 0 && (
            <motion.li
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-sw border border-dashed border-ink/15 py-14 text-center text-[0.9rem] text-ink/55"
            >
              {tab === "pending" ? "Nothing waiting. Every comment has been checked." : "No comments here yet."}
            </motion.li>
          )}
          {shown.map((c, i) => (
            <motion.li
              key={c.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT, delay: Math.min(i, 10) * 0.03 } }}
              exit={{ opacity: 0, x: c.status === "approved" ? 40 : -40, transition: { duration: 0.25 } }}
              className={cn(
                "grid gap-3 rounded-sw border border-ink/10 bg-white p-4 transition-shadow duration-300 hover:shadow-[0_12px_30px_-22px_rgba(19,23,19,0.45)]",
                "md:grid-cols-[6.5rem_minmax(0,1fr)_12rem_auto] md:items-center",
                busy === c.id && "opacity-70",
              )}
            >
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/55">{c.date}</span>
              <p className="flex items-start gap-2 text-[0.9rem] leading-snug text-ink">
                <span
                  aria-label={c.sentiment === "neg" ? "Concern" : c.sentiment === "pos" ? "Positive" : "Comment"}
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full border border-ink/40",
                    c.sentiment === "neg" ? "bg-coral" : c.sentiment === "pos" ? "bg-olive" : "bg-white",
                  )}
                />
                {c.body}
              </p>
              <label className="flex flex-col gap-1">
                <span className="sr-only">Theme</span>
                <select
                  value={c.theme}
                  onChange={(event) => change(c, { theme: event.target.value })}
                  className="h-8 rounded-sw border border-ink/15 bg-white px-2 text-[0.8rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
                >
                  <option value="">No theme</option>
                  {Object.entries(themeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-1.5 md:justify-end">
                {c.status !== "approved" && (
                  <ActionButton tone="approve" onClick={() => change(c, { status: "approved" })} disabled={busy === c.id}>
                    <Check className="size-3.5" aria-hidden="true" /> Approve
                  </ActionButton>
                )}
                {c.status !== "rejected" && (
                  <ActionButton tone="reject" onClick={() => change(c, { status: "rejected" })} disabled={busy === c.id}>
                    <X className="size-3.5" aria-hidden="true" /> Reject
                  </ActionButton>
                )}
                {c.status !== "pending" && (
                  <ActionButton tone="plain" onClick={() => change(c, { status: "pending" })} disabled={busy === c.id}>
                    <Undo2 className="size-3.5" aria-hidden="true" /> Back to waiting
                  </ActionButton>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
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
