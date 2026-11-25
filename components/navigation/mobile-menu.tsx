"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";
import { EASE_IN_OUT, EASE_OUT, NAV_TIMING } from "@/lib/motion";
import { NAV_CTA, NAV_LINKS, NAV_LOGIN } from "@/lib/navigation";
import Link from "next/link";

type MobileMenuProps = {
  id: string;
  open: boolean;
  onClose: () => void;
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
};

/** Full-screen menu for phones and tablets. Locks page scroll while open. */
export function MobileMenu({ id, open, onClose, onNavigate }: MobileMenuProps) {
  const reduce = useReducedMotion() ?? false;
  const lenis = useLenis();
  const firstLink = useRef<HTMLAnchorElement | null>(null);

  // Scroll lock, Escape to close, focus the first link on open.
  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const focus = window.setTimeout(() => firstLink.current?.focus(), 50);
    return () => {
      lenis?.start();
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focus);
    };
  }, [open, lenis, onClose]);

  // Items rise in one after another, then all leave together, fast.
  const item = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { y: "110%" },
    animate: reduce ? { opacity: 1 } : { y: "0%" },
    exit: reduce
      ? { opacity: 0, transition: { duration: 0.15 } }
      : { y: "110%", transition: { duration: 0.3, ease: EASE_IN_OUT } },
    transition: {
      duration: 0.6,
      ease: EASE_OUT,
      delay: reduce ? 0 : 0.18 + i * 0.06,
    },
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id={id}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-30 flex flex-col bg-white px-2.5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-24 lg:hidden"
          initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
          animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)" }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0.2 } }
              : {
                  clipPath: "inset(0 0 100% 0)",
                  transition: { duration: 0.45, ease: EASE_IN_OUT, delay: 0.1 },
                }
          }
          transition={{ duration: reduce ? 0.2 : NAV_TIMING.menu, ease: EASE_IN_OUT }}
        >
          <nav aria-label="Main" className="flex flex-1 flex-col">
            <ul className="flex flex-col">
              {NAV_LINKS.map((link, i) => (
                <li key={link.href} className="overflow-hidden border-b border-ink/10">
                  <motion.a
                    ref={i === 0 ? firstLink : undefined}
                    href={link.href}
                    onClick={(e) => onNavigate(e, link.href)}
                    className="flex items-baseline justify-between gap-4 py-4 text-[clamp(2rem,9vw,2.84rem)] font-medium leading-none tracking-[-0.02em] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                    {...item(i)}
                  >
                    {link.label}
                    <span className="font-mono text-[0.69rem] tracking-[0.1em] text-ink/60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </motion.a>
                </li>
              ))}
            </ul>

            <div className="mt-auto flex flex-col gap-3 overflow-hidden pt-8">
              <motion.div {...item(NAV_LINKS.length)}>
                <Link
                  href={NAV_LOGIN.href}
                  onClick={onClose}
                  className="flex h-14 w-full items-center justify-center rounded-sw border border-ink/15 text-lg text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {NAV_LOGIN.label}
                </Link>
              </motion.div>
              <motion.a
                href={NAV_CTA.href}
                onClick={(e) => onNavigate(e, NAV_CTA.href)}
                className="flex h-14 w-full items-center justify-center rounded-sw bg-coral text-lg font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                {...item(NAV_LINKS.length + 1)}
              >
                {NAV_CTA.label}
              </motion.a>
            </div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
