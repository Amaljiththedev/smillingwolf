"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { useIntroPlaying } from "@/components/intro/intro-provider";
import { EASE_OUT } from "@/lib/motion";
import { TRUSTED_BY } from "@/lib/trusted";

const MIN_ITEMS = 6; // repeat short lists so one run is wider than the window
const SECONDS_PER_ITEM = 2.5; // keeps the speed even whatever the list length

type TrustedMarqueeProps = {
  label?: string;
  names?: string[];
};

/** Repeats names until the run holds at least MIN_ITEMS entries. */
function fillRun(names: string[]) {
  if (names.length === 0) return [];
  return Array.from({ length: Math.ceil(MIN_ITEMS / names.length) }, () => names).flat();
}

const nameClass =
  "whitespace-nowrap text-[1.09rem] font-medium leading-none tracking-[-0.01em] text-ink";

function Run({ names }: { names: string[] }) {
  return (
    <ul className="flex shrink-0 items-center">
      {names.map((name, i) => (
        <li key={`${name}-${i}`} className="flex items-center">
          <span className={`${nameClass} px-4`}>{name}</span>
          <span className="size-1.5 shrink-0 rounded-full bg-coral" />
        </li>
      ))}
    </ul>
  );
}

/*
  Compact trusted-by strip, sits under the hero headline.
  CSS transform animation only (no JavaScript per frame). Pauses on hover
  and keyboard focus. With reduced motion it becomes a static list.
*/
export function TrustedMarquee({
  label = "Trusted by the teams behind",
  names = TRUSTED_BY,
}: TrustedMarqueeProps) {
  const reduce = useReducedMotion() ?? false;
  const introPlaying = useIntroPlaying();
  const run = useMemo(() => fillRun(names), [names]);

  if (names.length === 0) return null;

  return (
    <motion.div
      role="group"
      aria-label={label}
      className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
      initial={reduce ? false : { opacity: 0 }}
      animate={introPlaying ? undefined : { opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.35 }}
    >
      <p className="shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/60">
        {label}
      </p>

      {reduce ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {names.map((name) => (
            <li key={name} className={nameClass}>
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <div
          tabIndex={0}
          className="group relative min-w-0 flex-1 overflow-hidden py-1 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="sr-only">{names.join(", ")}</span>
          <div
            aria-hidden="true"
            className="flex w-max animate-marquee will-change-transform group-hover:[animation-play-state:paused] group-focus-visible:[animation-play-state:paused]"
            style={{ ["--marquee-duration" as string]: `${run.length * SECONDS_PER_ITEM}s` }}
          >
            <Run names={run} />
            <Run names={run} />
          </div>
        </div>
      )}
    </motion.div>
  );
}
