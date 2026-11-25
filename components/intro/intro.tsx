"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React, { memo, useMemo } from "react";
import { useIntroTimeline } from "@/hooks/use-intro-timeline";
import { PRODUCT } from "@/lib/brand";
import { EASE_IN_OUT, EASE_OUT, INTRO_TIMING } from "@/lib/motion";
import { useIntro } from "./intro-provider";

/*
  Intro – plays once on load, then leaves the DOM.
  0.15s   letters start fanned out and tilted
  ~1.35s  letters have settled into the headline
  2.0s    the intro slides up like a scroll
  ~2.5s   the intro is unmounted
  Any scroll, swipe, tap or key press skips straight to the exit.
  Ink #131713 on white, Bagoss Medium headline, Fragment Mono label.
*/

type Letter = { char: string; index: number };
type Word = { key: string; letters: Letter[] };

/** Splits text into words of indexed letters, so words never break mid-word. */
function splitWords(text: string): { words: Word[]; centre: number } {
  let index = 0;
  const words = text.split(" ").map((w, wi) => ({
    key: `${wi}-${w}`,
    letters: [...w].map((char) => ({ char, index: index++ })),
  }));
  return { words, centre: (index - 1) / 2 };
}

/* Offsets are in em so the spread scales with the headline on every screen. */
const AnimatedLetter = memo(function AnimatedLetter({
  char,
  offset,
  animate,
}: {
  char: string;
  offset: number;
  animate: boolean;
}) {
  return (
    <motion.span
      className="inline-block will-change-transform"
      initial={animate ? { x: `${offset * 0.45}em`, rotateX: offset * 45 } : false}
      animate={{ x: "0em", rotateX: 0 }}
      transition={{ ...INTRO_TIMING.assemble, ease: EASE_OUT }}
    >
      {char}
    </motion.span>
  );
});

function IntroLayer({ headline, reduce }: { headline: string; reduce: boolean }) {
  const { finish } = useIntro();
  const { words, centre } = useMemo(() => splitWords(headline), [headline]);
  useIntroTimeline(INTRO_TIMING.holdMs, finish);

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-0 z-50 flex h-svh flex-col bg-white text-ink"
      exit={reduce ? { opacity: 0 } : { y: "-100%" }}
      transition={{ duration: reduce ? INTRO_TIMING.fade : INTRO_TIMING.exit, ease: EASE_IN_OUT }}
    >
      <div className="flex items-center justify-between px-2.5 pt-[max(1.25rem,env(safe-area-inset-top))] min-[810px]:px-5 md:pt-6">
        <span className="text-lg font-medium tracking-[-0.01em]">{PRODUCT.name}</span>
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/60 md:text-[0.69rem]">
          by {PRODUCT.maker}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center px-2.5 min-[810px]:px-5">
        <p
          className="max-w-5xl text-balance text-center text-[clamp(3.25rem,15vw,8.5rem)] font-medium uppercase leading-[0.95] tracking-[-0.03em] md:text-[clamp(3.25rem,11vw,8.5rem)]"
          style={{ perspective: "500px" }}
        >
          {words.map((word, wi) => (
            <React.Fragment key={word.key}>
              {wi > 0 && " "}
              <span className="inline-block whitespace-nowrap">
                {word.letters.map((l) => (
                  <AnimatedLetter
                    key={l.index}
                    char={l.char}
                    offset={l.index - centre}
                    animate={!reduce}
                  />
                ))}
              </span>
            </React.Fragment>
          ))}
        </p>
      </div>
    </motion.div>
  );
}

/** The one-off intro. Renders nothing once it has left. */
export function Intro({ headline = "Have your say" }: { headline?: string }) {
  const { playing } = useIntro();
  const reduce = useReducedMotion() ?? false;

  return (
    <AnimatePresence>
      {playing && <IntroLayer key="intro" headline={headline} reduce={reduce} />}
    </AnimatePresence>
  );
}
