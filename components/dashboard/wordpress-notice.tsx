/* Shown in place of a results screen when WordPress cannot be reached. */
export function WordPressNotice({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink/55">Results unavailable</p>
      <h1 className="mt-3 text-[1.8rem] font-medium tracking-[-0.02em] text-ink">We could not load this scheme&apos;s results</h1>
      <p role="alert" className="mt-4 text-[0.95rem] text-ink/70">
        {message}
      </p>
    </div>
  );
}
