import { cn } from "@/lib/utils";

/* The one heading style for every section: mono label, then the title. */
export function SectionHeading({
  label,
  title,
  id,
  className,
}: {
  label: string;
  title: string;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-[40rem]", className)}>
      <p className="font-mono text-[0.75rem] uppercase tracking-[0.1em] text-ink/60 md:text-[0.85rem]">
        {label}
      </p>
      <h2
        id={id}
        className="mt-3 text-balance text-[clamp(2.25rem,4vw,3.2rem)] font-medium leading-[1.08] tracking-[-0.02em] text-ink"
      >
        {title}
      </h2>
    </div>
  );
}
