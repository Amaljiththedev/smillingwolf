"use client";

import { useReducedMotion } from "framer-motion";
import ReactLenis from "lenis/react";
import "lenis/dist/lenis.css";
import type { ReactNode } from "react";

/** App-wide smooth scrolling (Lenis). Native scrolling when motion is reduced. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion() ?? false;

  return (
    <ReactLenis root options={{ lerp: reduce ? 1 : 0.09, smoothWheel: !reduce }}>
      {children}
    </ReactLenis>
  );
}
