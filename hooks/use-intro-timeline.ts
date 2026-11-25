"use client";

import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";

/* Visitor input that skips the intro straight to its exit. */
const SKIP_EVENTS = ["wheel", "touchmove", "keydown", "pointerdown"] as const;

/**
 * Drives the intro: calls `onLeave` once, after `holdMs` or on the first
 * visitor input, whichever comes first. While the intro is mounted the page
 * is pinned to the top and page scrolling is locked; both are released when
 * the intro unmounts (after its exit animation).
 */
export function useIntroTimeline(holdMs: number, onLeave: () => void) {
  const lenis = useLenis();
  const onLeaveRef = useRef(onLeave);

  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  // Timer and skip listeners: fire once, then tidy up.
  useEffect(() => {
    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      cleanup();
      onLeaveRef.current();
    };
    const timer = window.setTimeout(leave, holdMs);
    SKIP_EVENTS.forEach((e) => window.addEventListener(e, leave, { passive: true }));

    function cleanup() {
      window.clearTimeout(timer);
      SKIP_EVENTS.forEach((e) => window.removeEventListener(e, leave));
    }
    return cleanup;
  }, [holdMs]);

  // Scroll lock for the life of the intro.
  useEffect(() => {
    if (!lenis) return;
    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.stop();
    return () => lenis.start();
  }, [lenis]);
}
