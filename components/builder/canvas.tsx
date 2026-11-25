"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { BlockRender } from "@/components/builder/block-render";
import { definitionFor } from "@/lib/blocks";
import type { Block } from "@/lib/sites";
import { cn } from "@/lib/utils";

/*
  The page canvas: the blocks as they will appear, each one selectable,
  draggable by its handle, and with duplicate/delete on hover.
*/

function SortableBlock({
  block,
  accent,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  block: Block;
  accent: string;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "relative cursor-pointer outline-none ring-inset transition-shadow duration-150",
          selected
            ? "ring-2 ring-ink"
            : "ring-1 ring-transparent hover:ring-ink/20 focus-visible:ring-2 focus-visible:ring-ink/40",
        )}
      >
        <BlockRender block={block} accent={accent} />
      </div>

      {/* Controls, pinned to the block's top-right */}
      <div
        className={cn(
          "absolute -top-3 right-2 flex items-center gap-0.5 rounded-sw border border-ink/15",
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
          onClick={onDuplicate}
          aria-label={`Duplicate ${label} block`}
          className="grid size-6 place-items-center rounded-[3px] text-ink/60 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          <Copy className="size-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete ${label} block`}
          className="grid size-6 place-items-center rounded-[3px] text-ink/60 hover:bg-coral hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
        >
          <Trash2 className="size-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Reorder ${label} block`}
          className="grid size-6 cursor-grab place-items-center rounded-[3px] text-ink/60 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function Canvas({
  blocks,
  accent,
  selectedId,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  blocks: Block[];
  accent: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });

  return (
    <div className="flex h-full justify-center overflow-y-auto bg-paper p-5">
      <div className="w-full max-w-[46rem]">
        {/* Browser chrome, so the canvas reads as a page not a form */}
        <div className="flex items-center gap-2 rounded-t-sw border border-b-0 border-ink/10 bg-white px-3 py-2">
          <span className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="size-1.5 rounded-full bg-ink/15" />
            ))}
          </span>
          <span className="truncate font-mono text-[0.6rem] text-ink/45">Page preview</span>
        </div>

        <div
          ref={setNodeRef}
          className={cn(
            "min-h-[22rem] rounded-b-sw border border-ink/10 bg-white transition-colors duration-200",
            isOver && blocks.length === 0 && "border-ink/30 bg-lime/20",
          )}
        >
          <SortableContext
            items={blocks.map((block) => block.id)}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                accent={accent}
                selected={block.id === selectedId}
                onSelect={() => onSelect(block.id)}
                onDuplicate={() => onDuplicate(block.id)}
                onRemove={() => onRemove(block.id)}
              />
            ))}
          </SortableContext>

          {blocks.length === 0 && (
            <p className="grid min-h-[22rem] place-items-center px-6 text-center font-mono text-[0.68rem] uppercase tracking-[0.1em] text-ink/40">
              Drag a block here to start the page
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
