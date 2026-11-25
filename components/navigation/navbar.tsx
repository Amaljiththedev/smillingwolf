"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useIntroPlaying } from "@/components/intro/intro-provider";
import { useNavScroll } from "@/hooks/use-nav-scroll";
import { PRODUCT } from "@/lib/brand";
import { EASE_IN_OUT, EASE_OUT, NAV_TIMING } from "@/lib/motion";
import { NAV_CTA, NAV_HEIGHT, NAV_LINKS, NAV_LOGIN } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { MenuToggle } from "./menu-toggle";
import { MobileMenu } from "./mobile-menu";

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/*
  Navbar – arrives as the intro leaves, hides on scroll down, returns on
  scroll up, and gains a white background once the page has moved.
  Desktop (lg+): inline links with a sliding underline and a coral CTA.
  Below lg: a menu button that opens a full-screen menu.
*/
export function Navbar() {
  const introPlaying = useIntroPlaying();
  const reduce = useReducedMotion() ?? false;
  const lenis = useLenis();
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const { hidden, scrolled } = useNavScroll(open);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  // Close the menu if the screen grows to desktop size.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  // Smooth-scroll to a section; falls back to the normal jump without Lenis.
  const navigate = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      const target = document.querySelector(href);
      setOpen(false);
      if (!lenis || !target) return;
      event.preventDefault();
      // Wait one frame so the menu's scroll lock is released first.
      requestAnimationFrame(() =>
        lenis.scrollTo(target as HTMLElement, {
          offset: -NAV_HEIGHT,
          duration: reduce ? 0 : NAV_TIMING.jump,
          easing: easeInOutCubic,
          immediate: reduce,
        }),
      );
      history.replaceState(null, "", href);
    },
    [lenis, reduce],
  );

  const arrive = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: -10 },
          animate: introPlaying ? undefined : { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: EASE_OUT, delay: 0.2 + i * NAV_TIMING.stagger },
        };

  const showBar = !introPlaying && !hidden;

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-40"
        initial={reduce ? false : { y: "-100%" }}
        animate={{ y: showBar || open ? "0%" : "-100%" }}
        transition={{ duration: reduce ? 0 : NAV_TIMING.bar, ease: EASE_IN_OUT }}
      >
        <div
          className={cn(
            "border-b transition-[background-color,border-color] duration-300",
            scrolled && !open
              ? "border-ink/10 bg-white/90 backdrop-blur-md"
              : "border-transparent bg-transparent",
          )}
        >
          <div
            className="mx-auto flex max-w-none items-center justify-between gap-6 px-2.5 pt-[env(safe-area-inset-top)] min-[810px]:px-5"
            style={{ height: NAV_HEIGHT }}
          >
            {/* Wordmark */}
            <motion.a
              href="#top"
              onClick={(e) => navigate(e, "#top")}
              className="flex items-baseline gap-3 rounded-sw focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
              {...arrive(0)}
            >
              <span className="text-lg font-medium tracking-[-0.01em] text-ink">
                {PRODUCT.name}
              </span>
              <span className="hidden font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/60 sm:inline">
                by {PRODUCT.maker}
              </span>
            </motion.a>

            {/* Desktop links */}
            <nav aria-label="Main" className="hidden lg:block">
              <ul className="flex items-center gap-8">
                {NAV_LINKS.map((link, i) => (
                  <motion.li key={link.href} {...arrive(i + 1)}>
                    <a
                      href={link.href}
                      onClick={(e) => navigate(e, link.href)}
                      className="relative py-2 text-[0.94rem] text-ink after:absolute after:inset-x-0 after:bottom-1 after:h-px after:origin-right after:scale-x-0 after:bg-ink after:transition-transform after:duration-500 after:ease-[cubic-bezier(0.22,1,0.36,1)] hover:after:origin-left hover:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink focus-visible:after:origin-left focus-visible:after:scale-x-100"
                    >
                      {link.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
            </nav>

            <div className="flex items-center gap-2.5">
              {/* Log in */}
              <motion.div {...arrive(NAV_LINKS.length + 1)} className="hidden sm:block">
                <Link
                  href={NAV_LOGIN.href}
                  className="inline-flex h-10 items-center gap-1.5 rounded-sw border border-ink/15 bg-white/60 px-4 text-[0.94rem] text-ink transition-colors duration-300 hover:border-ink/30 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {NAV_LOGIN.label}
                </Link>
              </motion.div>

              {/* CTA */}
              <motion.a
                href={NAV_CTA.href}
                onClick={(e) => navigate(e, NAV_CTA.href)}
                className="group hidden h-10 items-center gap-2 overflow-hidden rounded-sw bg-coral px-4 text-[0.94rem] font-medium text-ink transition-colors duration-300 hover:bg-peach focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:inline-flex"
                {...arrive(NAV_LINKS.length + 2)}
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-ink motion-safe:animate-pulse"
                />
                {NAV_CTA.label}
              </motion.a>

              <motion.div {...arrive(NAV_LINKS.length + 3)} className="lg:hidden">
                <MenuToggle
                  ref={toggleRef}
                  open={open}
                  onToggle={() => setOpen((o) => !o)}
                  controls={menuId}
                />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.header>

      <MobileMenu id={menuId} open={open} onClose={close} onNavigate={navigate} />
    </>
  );
}
