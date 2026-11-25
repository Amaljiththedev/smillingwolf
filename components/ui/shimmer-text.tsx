import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  Text with a band of full ink sweeping across it, then a short rest.
  CSS only. The resting colour is ink at 60% (4.73:1 on white), so the text
  stays readable at every point of the sweep. Coral is not used here because
  coral text fails contrast on white. Reduced motion: no sweep.
*/
export function ShimmerText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block bg-[linear-gradient(110deg,rgba(19,23,19,0.6)_38%,#131713_50%,rgba(19,23,19,0.6)_62%)] bg-[length:250%_100%] bg-clip-text bg-[position:100%_0] text-transparent motion-safe:animate-shimmer",
        className,
      )}
    >
      {children}
    </span>
  );
}
