"use client";

import { useDraggable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { BLOCK_DEFINITIONS, type BlockDefinition } from "@/lib/blocks";
import type { BlockKind } from "@/lib/sites";
import { cn } from "@/lib/utils";

/*
  The block palette. Each row can be dragged onto the canvas, or clicked to
  append to the end – dragging is nicer but clicking is faster, and it keeps
  the builder usable without a pointer.
*/

function PaletteItem({
  definition,
  used,
  onAdd,
}: {
  definition: BlockDefinition;
  used: boolean;
  onAdd: (kind: BlockKind) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${definition.kind}`,
    data: { from: "palette", kind: definition.kind },
    disabled: used,
  });
  const Icon = definition.icon;

  return (
    <li>
      <div
        ref={setNodeRef}
        className={cn(
          "group flex items-center gap-2.5 rounded-sw border border-ink/10 bg-white p-2.5",
          "transition-[border-color,opacity] duration-200",
          used ? "opacity-40" : "cursor-grab hover:border-ink/25 active:cursor-grabbing",
          isDragging && "opacity-30",
        )}
        {...listeners}
        {...attributes}
      >
        <Icon className="size-4 shrink-0 text-ink/70" strokeWidth={1.6} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.85rem] font-medium leading-tight text-ink">
            {definition.label}
          </span>
          <span className="block truncate text-[0.72rem] leading-tight text-ink/55">
            {used ? "Already on the page" : definition.hint}
          </span>
        </span>
        <button
          type="button"
          disabled={used}
          onClick={() => onAdd(definition.kind)}
          aria-label={`Add ${definition.label} block`}
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-[3px] text-ink/50",
            "transition-colors duration-200 hover:bg-ink/5 hover:text-ink",
            "focus-visible:outline-2 focus-visible:outline-ink disabled:pointer-events-none",
          )}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export function Palette({
  usedKinds,
  onAdd,
}: {
  usedKinds: Set<BlockKind>;
  onAdd: (kind: BlockKind) => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink/50">Blocks</p>
      <ul className="flex flex-col gap-1.5">
        {BLOCK_DEFINITIONS.map((definition) => (
          <PaletteItem
            key={definition.kind}
            definition={definition}
            used={Boolean(definition.once) && usedKinds.has(definition.kind)}
            onAdd={onAdd}
          />
        ))}
      </ul>
      <p className="mt-auto pt-3 text-[0.72rem] leading-snug text-ink/50">
        Drag a block onto the page, or press + to add it at the end.
      </p>
    </div>
  );
}
