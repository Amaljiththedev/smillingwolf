"use client";

import { motion } from "framer-motion";

/* Rolling-digit counter. Each digit is a reel of 0–9 that scrolls into place. */

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function Reel({ digit, lh, delay }: { digit: number; lh: number; delay: number }) {
  return (
    <span className="inline-block overflow-hidden align-top" style={{ height: lh }}>
      <motion.span
        className="flex flex-col"
        initial={false}
        animate={{ y: -digit * lh }}
        transition={{ duration: 1.6, ease: EASE, delay }}
      >
        {Array.from({ length: 10 }, (_, d) => (
          <span key={d} className="block" style={{ height: lh, lineHeight: `${lh}px` }}>
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

type OdometerProps = {
  value: number;
  /** Font size in px. */
  size: number;
  /** Digits sit at 0 until this is true. */
  run: boolean;
  suffix?: string;
  /** Pads to this many digits, so the width never jumps. */
  minDigits?: number;
  delay?: number;
};

export function Odometer({ value, size, run, suffix, minDigits = 0, delay = 0.2 }: OdometerProps) {
  const lh = Math.round(size * 1.05);
  const digits = String(value).padStart(minDigits, "0").split("");

  return (
    <span
      role="img"
      aria-label={`${value}${suffix ?? ""}`}
      className="inline-flex tabular-nums"
      style={{ fontSize: size, height: lh, lineHeight: `${lh}px` }}
    >
      <span aria-hidden="true" className="inline-flex select-none">
        {digits.map((c, i) => (
          <Reel key={i} digit={run ? Number(c) : 0} lh={lh} delay={delay + i * 0.08} />
        ))}
        {suffix && <span>{suffix}</span>}
      </span>
    </span>
  );
}
