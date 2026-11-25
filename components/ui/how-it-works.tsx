"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/*
  Pipeline – a compact horizontal roadmap at lg+, vertical stack below.
  Each step is a numbered node connected by a thin line. No illustration,
  no tilted cards, no pins. Text sits directly under each node.
*/

export type StepTone = "peach" | "blue" | "lilac" | "lime" | "yellow";
export type Step = { title: string; description: string; tone?: StepTone };

const TONE_BG: Record<StepTone, string> = {
  peach: "bg-peach",
  blue: "bg-blue",
  lilac: "bg-lilac",
  lime: "bg-lime",
  yellow: "bg-yellow",
};

function StepNode({
  step,
  index,
  total,
  show,
  reduce,
}: {
  step: Step;
  index: number;
  total: number;
  show: boolean;
  reduce: boolean;
}) {
  const isLast = index === total - 1;
  const delay = 0.08 + index * 0.1;

  return (
    <motion.li
      className="relative flex flex-1 items-start gap-3 lg:flex-col lg:items-center lg:gap-0 lg:text-center"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={show ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
    >
      {/* Node + connector */}
      <div className="relative flex flex-col items-center lg:mb-3 lg:w-full lg:flex-row lg:justify-center">
        {/* Connector line before */}
        {index > 0 && (
          <motion.span
            className="absolute bottom-full left-1/2 h-6 w-px bg-ink/15 lg:bottom-auto lg:left-0 lg:right-auto lg:top-1/2 lg:h-px lg:w-full lg:-translate-y-1/2"
            initial={reduce ? false : { scaleY: 0, scaleX: 1 }}
            animate={show ? { scaleY: 1, scaleX: 1 } : undefined}
            transition={{ duration: 0.3, delay: delay - 0.05 }}
            style={{ transformOrigin: "top center" }}
          />
        )}
        {/* Connector line after (desktop only) */}
        {!isLast && (
          <motion.span
            className="hidden lg:absolute lg:left-1/2 lg:top-1/2 lg:block lg:h-px lg:w-full lg:-translate-y-1/2 lg:bg-ink/15"
            initial={reduce ? false : { scaleX: 0 }}
            animate={show ? { scaleX: 1 } : undefined}
            transition={{ duration: 0.3, delay: delay + 0.05 }}
            style={{ transformOrigin: "left center" }}
          />
        )}
        {/* Numbered dot */}
        <span
          className={cn(
            "relative z-10 grid size-10 shrink-0 place-items-center rounded-full font-mono text-[0.85rem] font-medium text-ink",
            TONE_BG[step.tone ?? "peach"],
          )}
        >
          {index + 1}
        </span>
      </div>
      {/* Text */}
      <div className="min-w-0 pb-6 lg:px-2 lg:pb-0">
        <h3 className="text-[1.1rem] font-medium leading-tight tracking-[-0.01em] text-ink">
          {step.title}
        </h3>
        <p className="mt-1 text-[0.9rem] leading-[1.45] text-ink/70">{step.description}</p>
      </div>
    </motion.li>
  );
}

export function HowItWorksSteps({ steps, className }: { steps: Step[]; className?: string }) {
  const ref = useRef<HTMLOListElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion() ?? false;
  const show = inView || reduce;

  return (
    <ol ref={ref} className={cn("flex flex-col gap-0 lg:flex-row lg:items-start", className)}>
      {steps.map((step, i) => (
        <StepNode
          key={step.title}
          step={step}
          index={i}
          total={steps.length}
          show={show}
          reduce={reduce}
        />
      ))}
    </ol>
  );
}
