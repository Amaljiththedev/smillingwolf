"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type IntroState = {
  /** True while the intro is on screen. */
  playing: boolean;
  /** Ends the intro. Safe to call more than once. */
  finish: () => void;
};

const IntroContext = createContext<IntroState | null>(null);

/** Shares the intro's state, so sections can react when it leaves. */
export function IntroProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(true);
  const finish = useCallback(() => setPlaying(false), []);
  const value = useMemo(() => ({ playing, finish }), [playing, finish]);

  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}

export function useIntro(): IntroState {
  const ctx = useContext(IntroContext);
  if (!ctx) throw new Error("useIntro must be used inside <IntroProvider>.");
  return ctx;
}

/** True while the intro is on screen; false when there is no intro on the page. */
export function useIntroPlaying(): boolean {
  return useContext(IntroContext)?.playing ?? false;
}
