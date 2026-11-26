"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  CircleHelp,
  Copy,
  ExternalLink,
  GripVertical,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BlockRender } from "@/components/builder/block-render";
import { DeviceSwitch } from "@/components/builder/devices";
import { frameFor, type Device } from "@/lib/devices";
import { themeById, themeStyle } from "@/lib/themes";
import { definitionFor } from "@/lib/blocks";
import type { Block } from "@/lib/sites";
import { cn } from "@/lib/utils";

/*
  The page canvas: the blocks as they will appear, each one selectable,
  draggable by its handle, and with duplicate/delete on hover.

  The page is drawn at a real device width (phone 390px, tablet 768px,
  desktop 1024px or more) and scaled down to fit when the screen is smaller,
  so the layout you see is the layout visitors get. Blocks respond to the
  page's width through container queries, not to the browser window.
*/

function SortableBlock({
  block,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
  onMove,
  first,
  last,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (step: -1 | 1) => void;
  first: boolean;
  last: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: { from: "canvas" },
  });
  const label = definitionFor(block.kind).label;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group relative", isDragging && "z-20 opacity-50")}
    >
      {/* Click target for selection. A button would swallow the block's own markup. */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Select ${label} block`}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "op-editing relative cursor-pointer outline-none ring-inset transition-shadow duration-150",
          selected
            ? "ring-2 ring-ink"
            : "ring-1 ring-transparent hover:ring-ink/20 focus-visible:ring-2 focus-visible:ring-ink/40",
        )}
      >
        <BlockRender block={block} editing />
      </div>

      {/* Controls, pinned to the block's top-right */}
      <div
        className={cn(
          "absolute right-2 top-2 z-30 flex items-center gap-0.5 rounded-sw border border-ink/15",
          "bg-white p-0.5 shadow-[0_6px_16px_-8px_rgba(19,23,19,0.4)] transition-opacity duration-150",
          selected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        <span className="px-1.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-ink/55">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={first}
          aria-label={`Move ${label} block up`}
          title="Move up"
          className="grid size-7 place-items-center rounded-[3px] text-ink/60 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowUp className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={last}
          aria-label={`Move ${label} block down`}
          title="Move down"
          className="grid size-7 place-items-center rounded-[3px] text-ink/60 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowDown className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          aria-label={`Duplicate ${label} block`}
          className="grid size-7 place-items-center rounded-[3px] text-ink/60 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          <Copy className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete ${label} block`}
          className="grid size-7 place-items-center rounded-[3px] text-ink/60 hover:bg-coral hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Reorder ${label} block`}
          className="grid size-7 cursor-grab touch-none place-items-center rounded-[3px] text-ink/60 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Width of an element's content box, kept up to date. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function Canvas({
  siteId,
  blocks,
  accent,
  theme,
  selectedId,
  onSelect,
  onDuplicate,
  onRemove,
  onMove,
  onTour,
}: {
  siteId: string;
  blocks: Block[];
  accent: string;
  theme: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, step: -1 | 1) => void;
  onTour: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  const [picked, setDevice] = useState<Device | null>(null);
  const [measure, available] = useWidth<HTMLDivElement>();
  /* Until a size is picked: phone view on narrow screens, desktop otherwise. */
  const device: Device =
    picked ?? (available !== null && available < 640 ? "phone" : "desktop");
  const frame = frameFor(device, available);
  const phone = device === "phone";

  return (
    <div className="h-full overflow-y-auto bg-paper px-4 pb-24 pt-4 lg:px-8 lg:pb-12">
      <div ref={measure} className="w-full">
        {/* Device and preview controls */}
        <div className="sticky top-0 z-40 -mx-4 mb-4 flex items-center justify-between gap-3 bg-paper/85 px-4 py-2 backdrop-blur lg:-mx-8 lg:px-8">
          <span data-tour="devices" className="inline-flex">
            <DeviceSwitch device={device} onChange={setDevice} />
          </span>
          <span className="hidden font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/45 sm:inline">
            {frame.width}px
            {frame.zoom < 1 ? ` · ${Math.round(frame.zoom * 100)}%` : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onTour}
              title="Show the tour again"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 text-[0.8rem] font-medium text-ink transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <CircleHelp className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Tour</span>
              <span className="sr-only sm:hidden">Show the tour</span>
            </button>
            <Link
              data-tour="preview"
              href={`/builder/${siteId}/preview?device=${device}`}
              target="_blank"
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[0.8rem] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              Preview
            </Link>
          </span>
        </div>

        <div
          className={cn(
            "mx-auto",
            phone &&
              "rounded-[2.2rem] border-[7px] border-ink bg-ink shadow-[0_30px_60px_-30px_rgba(19,23,19,0.5)]",
          )}
          style={{
            width:
              available === null
                ? "100%"
                : frame.width * frame.zoom + (phone ? 14 : 0),
          }}
        >
          {/* Browser chrome or phone status bar, so the canvas reads as a page not a form */}
          {phone ? (
            <div className="flex h-7 items-center justify-center rounded-t-[1.75rem] bg-white">
              <span
                aria-hidden="true"
                className="h-4 w-20 rounded-full bg-ink"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-t-xl border border-b-0 border-ink/10 bg-white px-4 py-2.5">
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((dot) => (
                  <span key={dot} className="size-2 rounded-full bg-ink/12" />
                ))}
              </span>
              <span className="mx-auto truncate rounded-full bg-paper px-3 py-0.5 font-mono text-[0.6rem] text-ink/45">
                {siteId}.consultation
              </span>
              <span className="w-8" aria-hidden="true" />
            </div>
          )}

          <div
            ref={setNodeRef}
            className={cn(
              "op-page @container min-h-[22rem] overflow-hidden transition-colors duration-200",
              phone
                ? "rounded-b-[1.75rem]"
                : "rounded-b-xl border border-ink/10 shadow-[0_30px_60px_-40px_rgba(19,23,19,0.35)]",
              isOver && blocks.length === 0 && "border-ink/30 bg-lime/20",
            )}
            style={{
              ...themeStyle(themeById(theme), accent),
              ...(available === null
                ? {}
                : { width: frame.width, zoom: frame.zoom }),
            }}
          >
            <SortableContext
              items={blocks.map((block) => block.id)}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map((block, index) => (
                <SortableBlock
                  first={index === 0}
                  last={index === blocks.length - 1}
                  onMove={(step) => onMove(block.id, step)}
                  key={block.id}
                  block={block}
                  selected={block.id === selectedId}
                  onSelect={() => onSelect(block.id)}
                  onDuplicate={() => onDuplicate(block.id)}
                  onRemove={() => onRemove(block.id)}
                />
              ))}
            </SortableContext>

            {blocks.length === 0 && (
              <p className="grid min-h-[22rem] place-items-center px-6 text-center font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ink/40">
                Drag a block here, or tap one in the list
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
