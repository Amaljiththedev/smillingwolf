import type { Transition } from "framer-motion";

/* Shared motion values, so the intro and the sections move as one. */
export const EASE_OUT: Transition["ease"] = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT: Transition["ease"] = [0.76, 0, 0.24, 1];
/** Cards and panels settling into place. */
export const EASE_CARD: Transition["ease"] = [0.42, 0, 0, 1];

export const INTRO_TIMING = {
  /** Time the intro is on screen before it leaves (ms). */
  holdMs: 2000,
  /** Letters settling into the headline (s). */
  assemble: { delay: 0.15, duration: 1.2 },
  /** Intro sliding away and content rising in (s). */
  exit: 0.5,
  /** Reduced-motion fade (s). */
  fade: 0.3,
} as const;

export const NAV_TIMING = {
  /** Bar sliding in or hiding on scroll (s). */
  bar: 0.5,
  /** Delay between desktop items as they arrive (s). */
  stagger: 0.05,
  /** Mobile menu opening and closing (s). */
  menu: 0.55,
  /** Scroll to a section after a link is clicked (s). */
  jump: 1.2,
} as const;
