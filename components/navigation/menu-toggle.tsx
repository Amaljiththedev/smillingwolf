"use client";

import { motion } from "framer-motion";
import { forwardRef } from "react";
import { EASE_IN_OUT } from "@/lib/motion";

type MenuToggleProps = { open: boolean; onToggle: () => void; controls: string };

/** Two lines that cross into an X. */
export const MenuToggle = forwardRef<HTMLButtonElement, MenuToggleProps>(function MenuToggle(
  { open, onToggle, controls },
  ref,
) {
  const transition = { duration: 0.35, ease: EASE_IN_OUT };

  return (
    <button
      ref={ref}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={open ? "Close menu" : "Open menu"}
      className="relative -mr-2 grid size-11 place-items-center rounded-sw focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden"
    >
      <span className="relative block h-3 w-6">
        <motion.span
          className="absolute left-0 top-0 h-[1.5px] w-full bg-ink"
          animate={open ? { y: 5.25, rotate: 45 } : { y: 0, rotate: 0 }}
          transition={transition}
        />
        <motion.span
          className="absolute bottom-0 left-0 h-[1.5px] w-full bg-ink"
          animate={open ? { y: -5.25, rotate: -45 } : { y: 0, rotate: 0 }}
          transition={transition}
        />
      </span>
    </button>
  );
});
