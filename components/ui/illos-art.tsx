"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/*
  Renders an Illos illustration inline (decorative). It loops while a quarter
  of it is on screen, pauses off screen, and stays still for reduced motion.
  The play logic is from the illos-usage-pricing reference (MIT); the
  illustrations themselves are under the Illos free license.
*/
export function IllosArt({
  svg,
  className,
  style,
}: {
  svg: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => (ref.current ? loopInView(ref.current) : undefined), []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("[&>svg]:h-auto [&>svg]:w-full", className)}
      style={{ "--illos-play": "paused", ...style } as CSSProperties}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Restarts the CSS animations each cycle while visible; pauses when off screen. */
function loopInView(host: HTMLElement): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const animations = () => host.getAnimations({ subtree: true });
  let visible = false;
  let stopped = false;
  let waiting = false;

  const loop = () => {
    if (waiting || stopped || !visible) return;
    const list = animations();
    if (!list.length) return;
    waiting = true;
    Promise.all(list.map((a) => a.finished)).then(
      () =>
        requestAnimationFrame(() => {
          waiting = false;
          if (stopped || !visible) return;
          for (const a of animations()) a.currentTime = 0; // seek only, keeps CSS in control
          loop();
        }),
      () =>
        requestAnimationFrame(() => {
          waiting = false; // an animation was cancelled: pick the loop back up
          loop();
        }),
    );
  };

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      host.style.setProperty("--illos-play", visible ? "running" : "paused");
      loop();
    },
    { threshold: 0.25 },
  );
  io.observe(host);
  return () => {
    stopped = true;
    io.disconnect();
  };
}
