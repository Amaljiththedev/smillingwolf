"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MapPin } from "lucide-react";
import { readAnimation, readList, readText, type AnimationName } from "@/lib/blocks";
import { EASE_OUT } from "@/lib/motion";
import type { Block } from "@/lib/sites";

/*
  What each block looks like on the page. One branch per block kind.
  These render inside the editor canvas and, later, on the published site,
  so they take only the block's props and the site's accent colour.
*/

const VARIANTS: Record<AnimationName, { initial: Record<string, number>; duration: number }> = {
  none: { initial: {}, duration: 0 },
  fade: { initial: { opacity: 0 }, duration: 0.5 },
  rise: { initial: { opacity: 0, y: 24 }, duration: 0.6 },
  slide: { initial: { opacity: 0, x: -32 }, duration: 0.6 },
  scale: { initial: { opacity: 0, scale: 0.94 }, duration: 0.5 },
};

/** Wraps a block in its chosen entrance animation. */
function Animated({ block, children }: { block: Block; children: React.ReactNode }) {
  const reduce = useReducedMotion() ?? false;
  const name = readAnimation(block.props);
  const variant = VARIANTS[name];

  if (reduce || name === "none") return <>{children}</>;

  return (
    <motion.div
      /* Re-keyed on the animation name so changing it in the inspector replays it. */
      key={name}
      initial={variant.initial}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{ duration: variant.duration, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

function Header({ props, accent }: { props: Block["props"]; accent: string }) {
  const links = readList(props, "links");
  return (
    <div className="flex items-center justify-between gap-6 border-b border-ink/10 px-6 py-4">
      <span className="flex min-w-0 items-center gap-2 text-[0.95rem] font-medium text-ink">
        <span
          aria-hidden="true"
          className="size-3 shrink-0 rounded-[2px]"
          style={{ backgroundColor: accent }}
        />
        <span className="truncate">{readText(props, "title", "Your consultation")}</span>
      </span>
      <ul className="hidden gap-4 text-[0.8rem] text-ink/65 sm:flex">
        {links.map((link, index) => (
          <li key={`${link}-${index}`} className={index === 0 ? "text-ink" : undefined}>
            {link}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Hero({ props, accent }: { props: Block["props"]; accent: string }) {
  const cta = readText(props, "cta");
  return (
    <div className="px-6 py-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ink/55">
        {readText(props, "eyebrow")}
      </p>
      <h2 className="mt-3 max-w-[20ch] text-balance text-[1.9rem] font-medium leading-[1.08] tracking-[-0.02em] text-ink">
        {readText(props, "title", "Have your say")}
      </h2>
      <p className="mt-3 max-w-[48ch] text-pretty text-[0.95rem] leading-[1.5] text-ink/75">
        {readText(props, "body")}
      </p>
      {cta && (
        <span
          className="mt-5 inline-flex h-10 items-center rounded-sw px-4 text-[0.88rem] font-medium text-ink"
          style={{ backgroundColor: accent }}
        >
          {cta}
        </span>
      )}
    </div>
  );
}

function TextBlock({ props }: { props: Block["props"] }) {
  return (
    <div className="px-6 py-8">
      <h3 className="text-[1.2rem] font-medium leading-tight tracking-[-0.01em] text-ink">
        {readText(props, "title")}
      </h3>
      <p className="mt-2.5 max-w-[60ch] text-pretty text-[0.92rem] leading-[1.55] text-ink/75">
        {readText(props, "body")}
      </p>
    </div>
  );
}

/* A compact plan drawing. Stands in for the masterplan the client uploads. */
function MapBlock({ props, accent }: { props: Block["props"]; accent: string }) {
  const pinCount = Number(readText(props, "pins", "4")) || 0;
  const pins = [
    { x: 86, y: 44 },
    { x: 148, y: 72 },
    { x: 196, y: 38 },
    { x: 122, y: 96 },
  ].slice(0, pinCount);

  return (
    <div className="px-6 py-8">
      <h3 className="text-[1.2rem] font-medium leading-tight tracking-[-0.01em] text-ink">
        {readText(props, "title", "The masterplan")}
      </h3>
      <div className="mt-3 overflow-hidden rounded-sw border border-ink/10">
        <svg viewBox="0 0 280 130" className="block h-auto w-full" aria-hidden="true">
          <rect width="280" height="130" fill="#efede8" />
          {/* River */}
          <path d="M-5 112 C 60 104, 140 122, 285 110 L 285 135 L -5 135 Z" fill="#cfe5f1" />
          {/* Roads */}
          <g stroke="#ffffff" strokeWidth="5" fill="none">
            <path d="M0 30 H280 M0 86 H280 M60 0 V130 M210 0 V130" />
          </g>
          {/* Existing buildings */}
          <g fill="#dcd8d0">
            {[8, 22, 36].map((x) => (
              <rect key={`a${x}`} x={x} y="8" width="10" height="16" />
            ))}
            {[222, 238, 254].map((x) => (
              <rect key={`b${x}`} x={x} y="94" width="12" height="18" />
            ))}
          </g>
          {/* Site boundary and proposed scheme */}
          <rect x="68" y="34" width="134" height="50" fill={accent} opacity="0.3" />
          <g fill="#ffffff" stroke="#c9c4bb" strokeWidth="0.6">
            <rect x="76" y="40" width="28" height="16" />
            <rect x="112" y="40" width="20" height="26" />
            <rect x="166" y="42" width="28" height="14" />
          </g>
          <circle cx="146" cy="72" r="12" fill="#dbe6c8" />
          <rect
            x="68"
            y="34"
            width="134"
            height="50"
            fill="none"
            stroke="#ff8c88"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          {/* Comment pins */}
          {pins.map((pin, index) => (
            <g key={index} transform={`translate(${pin.x} ${pin.y})`}>
              <path
                d="M0 0 C -1.2 -3.2 -5.6 -6 -5.6 -10.4 A 5.6 5.6 0 1 1 5.6 -10.4 C 5.6 -6 1.2 -3.2 0 0 Z"
                fill="#ff8c88"
                stroke="#ffffff"
                strokeWidth="1"
              />
              <text y="-8.4" textAnchor="middle" fontSize="5.6" fill="#131713">
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[0.8rem] text-ink/65">
        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
        {readText(props, "caption")}
      </p>
    </div>
  );
}

function Survey({ props, accent }: { props: Block["props"]; accent: string }) {
  const answers = readList(props, "answers");
  return (
    <div className="px-6 py-8">
      <div className="rounded-sw border border-ink/10 bg-white p-4">
        <p className="text-[0.95rem] font-medium leading-snug text-ink">
          {readText(props, "question")}
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {answers.map((answer, index) => (
            <li
              key={`${answer}-${index}`}
              className="flex items-center gap-2.5 text-[0.85rem] text-ink"
            >
              <span
                aria-hidden="true"
                className="size-3.5 shrink-0 rounded-full border-2"
                style={{ borderColor: index === 0 ? accent : "rgba(19,23,19,0.2)" }}
              />
              {answer}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Timeline({ props, accent }: { props: Block["props"]; accent: string }) {
  const stages = readList(props, "stages");
  return (
    <div className="px-6 py-8">
      <h3 className="text-[1.2rem] font-medium leading-tight tracking-[-0.01em] text-ink">
        {readText(props, "title")}
      </h3>
      <ol className="mt-4 flex flex-col">
        {stages.map((stage, index) => (
          <li key={`${stage}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: index === 0 ? accent : "rgba(19,23,19,0.15)" }}
              />
              {index < stages.length - 1 && <span className="w-px flex-1 bg-ink/15" />}
            </div>
            <span className="pb-4 text-[0.88rem] leading-tight text-ink">{stage}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Footer({ props }: { props: Block["props"] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 px-6 py-5 text-[0.82rem] text-ink/70">
      <span>{readText(props, "contact")}</span>
      <span>{readText(props, "note")}</span>
    </div>
  );
}

export function BlockRender({ block, accent }: { block: Block; accent: string }) {
  const { props } = block;
  return (
    <Animated block={block}>
      {block.kind === "header" && <Header props={props} accent={accent} />}
      {block.kind === "hero" && <Hero props={props} accent={accent} />}
      {block.kind === "text" && <TextBlock props={props} />}
      {block.kind === "map" && <MapBlock props={props} accent={accent} />}
      {block.kind === "survey" && <Survey props={props} accent={accent} />}
      {block.kind === "timeline" && <Timeline props={props} accent={accent} />}
      {block.kind === "footer" && <Footer props={props} />}
    </Animated>
  );
}
