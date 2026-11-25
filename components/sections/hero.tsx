"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Fragment, type ReactNode } from "react";
import { useIntro } from "@/components/intro/intro-provider";
import { ShimmerText } from "@/components/ui/shimmer-text";
import { PRODUCT } from "@/lib/brand";
import { CONTAINER, GUTTER, SPLIT } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { EASE_IN_OUT, INTRO_TIMING } from "@/lib/motion";

type HeroProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Shown beside the text on large screens, below it on small ones. */
  visual?: ReactNode;
  /** Rendered under the headline, e.g. the trusted-by strip. */
  children?: ReactNode;
};

/** Keeps hyphenated words (e.g. "Design-led") from breaking at the hyphen. */
function keepHyphenatedWhole(text: string) {
  return text.split(" ").map((word, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      {word.includes("-") ? <span className="whitespace-nowrap">{word}</span> : word}
    </Fragment>
  ));
}

/** First content section. Rises into place as the intro slides away. */
export function Hero({
  eyebrow = "Built by consultation specialists",
  title = "Design-led public consultation platform, managed in-house.",
  description = `${PRODUCT.name} is the white-label platform for launching planning and regeneration consultation sites – modular pages, an interactive masterplan map, surveys and map comments – on your own brand and domain, live in a day.`,
  children,
  visual,
}: HeroProps) {
  const { playing } = useIntro();
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.section
      className={cn(
        "overflow-x-clip bg-white pb-6 pt-[calc(72px+clamp(1rem,3svh,2rem))] md:pb-8",
        GUTTER,
      )}
      initial={reduce ? false : { y: "12vh" }}
      animate={playing ? undefined : { y: 0 }}
      transition={{ duration: INTRO_TIMING.exit, ease: EASE_IN_OUT }}
    >
      <div className={cn(CONTAINER, SPLIT)}>
        <div className="flex min-w-0 flex-col items-start gap-4 md:gap-5">
          <p className="font-mono text-[0.75rem] uppercase tracking-[0.1em] text-ink/60 md:text-[0.85rem]">
            {eyebrow} at <ShimmerText>{PRODUCT.maker}</ShimmerText>
          </p>
          <h1 className="max-w-[18ch] text-balance text-[clamp(2.5rem,5.5vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.025em] text-ink">
            {keepHyphenatedWhole(title)}
          </h1>
          {description && (
            <p className="max-w-[40ch] text-pretty text-[1.15rem] leading-[1.5] text-ink/75 md:text-[1.4rem]">
              {keepHyphenatedWhole(description)}
            </p>
          )}
          {children && <div className="mt-1 w-full md:mt-2">{children}</div>}
        </div>
        {visual && <div className="w-full min-w-0">{visual}</div>}
      </div>
    </motion.section>
  );
}
