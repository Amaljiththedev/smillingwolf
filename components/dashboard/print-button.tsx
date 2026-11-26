"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-1.5 rounded-sw bg-ink px-3.5 text-[0.85rem] text-white transition-opacity duration-200 hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink print:hidden"
    >
      <Printer className="size-3.5" aria-hidden="true" />
      Print or save as PDF
    </button>
  );
}
