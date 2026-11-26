"use client";

import { ArrowLeft, EyeOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BlockRender } from "@/components/builder/block-render";
import { DeviceSwitch } from "@/components/builder/devices";
import { DEVICES, type Device } from "@/lib/devices";
import { parseSaved, useSavedRaw } from "@/lib/page-store";
import type { Site } from "@/lib/sites";
import { themeById, themeStyle } from "@/lib/themes";
import { cn } from "@/lib/utils";

/*
  The page as a visitor sees it, full screen and fully interactive (maps pan,
  sliders slide, questions open). It reads the editor's saved draft and
  follows edits made in another tab, so it can sit beside the editor.
*/

export function PagePreview({ site, initialDevice }: { site: Site; initialDevice: Device }) {
  const raw = useSavedRaw(site.id);
  const saved = useMemo(() => parseSaved(raw), [raw]);
  const blocks = saved?.blocks ?? site.blocks;
  const accent = saved?.accent ?? site.brand.accent;
  const theme = themeById(saved?.theme);

  const [device, setDevice] = useState<Device>(initialDevice);
  const [chrome, setChrome] = useState(true);
  const framed = device !== "desktop";
  const width = DEVICES.find((d) => d.key === device)!.width;

  return (
    <div className={cn("min-h-svh", framed ? "bg-paper py-6" : "bg-white")}>
      <div
        className={cn(
          "op-page @container mx-auto w-full",
          framed && "overflow-hidden rounded-[1.5rem] border border-ink/10 shadow-[0_30px_60px_-30px_rgba(19,23,19,0.35)]",
        )}
        style={{ ...themeStyle(theme, accent), ...(framed ? { maxWidth: width } : {}) }}
      >
        {blocks.map((block) => (
          <BlockRender key={block.id} block={block} />
        ))}
        {blocks.length === 0 && (
          <p className="grid min-h-[50svh] place-items-center text-[0.9rem] text-ink/50">This page has no blocks yet.</p>
        )}
      </div>

      {/* Preview controls, out of the way at the bottom */}
      {chrome ? (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-1.5 rounded-full border border-white/60 bg-white/80 p-1 shadow-[0_12px_32px_-12px_rgba(19,23,19,0.45)] backdrop-blur-xl">
            <Link
              href={`/builder/${site.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8rem] text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Editor</span>
            </Link>
            <span aria-hidden="true" className="h-5 w-px bg-ink/10" />
            <DeviceSwitch device={device} onChange={setDevice} className="border-0 bg-transparent" />
            <span aria-hidden="true" className="h-5 w-px bg-ink/10" />
            <button
              type="button"
              onClick={() => setChrome(false)}
              title="Hide these controls"
              aria-label="Hide preview controls"
              className="grid size-8 place-items-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
            >
              <EyeOff className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setChrome(true)}
          aria-label="Show preview controls"
          className="fixed bottom-4 right-4 z-50 size-3 rounded-full bg-ink/25 hover:bg-ink/60"
        />
      )}
    </div>
  );
}
