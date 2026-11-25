"use client";

import { useRef, useState } from "react";
import { useLenis } from "lenis/react";

const SCROLLED_AT = 8; // px from the top before the bar gets its background
const HIDE_AFTER = 160; // px from the top before scrolling down hides the bar
const DELTA = 6; // ignore tiny movements so the bar doesn't flicker

/**
 * Tracks whether the bar should be hidden (scrolling down) and whether the
 * page has left the top. Only sets state when a value actually changes.
 */
export function useNavScroll(keepVisible: boolean) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const last = useRef(0);
  const state = useRef({ hidden: false, scrolled: false });

  useLenis(
    ({ scroll }) => {
      const nextScrolled = scroll > SCROLLED_AT;
      if (nextScrolled !== state.current.scrolled) {
        state.current.scrolled = nextScrolled;
        setScrolled(nextScrolled);
      }

      const delta = scroll - last.current;
      if (Math.abs(delta) < DELTA) return;
      last.current = scroll;

      const nextHidden = !keepVisible && delta > 0 && scroll > HIDE_AFTER;
      if (nextHidden !== state.current.hidden) {
        state.current.hidden = nextHidden;
        setHidden(nextHidden);
      }
    },
    [keepVisible],
  );

  return { hidden: hidden && !keepVisible, scrolled };
}
