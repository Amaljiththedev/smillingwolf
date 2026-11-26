"use client";

import { useDraggable } from "@dnd-kit/core";
import { Search } from "lucide-react";
import { useState } from "react";
import { BLOCK_DEFINITIONS, BLOCK_GROUPS, type BlockDefinition } from "@/lib/blocks";
import type { BlockKind } from "@/lib/sites";
import { cn } from "@/lib/utils";

/*
  The block palette. Each tile can be dragged onto the canvas, or clicked to
  add it to the end of the page. Clicking keeps the builder usable without a
  pointer and on touch screens.
*/

function PaletteTile({
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
  /* Keyboard users add with Enter, so leave out the keyboard drag activator. */
  const { onKeyDown: _keyboardDrag, ...pointer } = listeners ?? {};
  void _keyboardDrag;

  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        disabled={used}
        onClick={() => onAdd(definition.kind)}
        title={used ? "Already on the page" : `${definition.hint}. Click to add, or drag onto the page.`}
        className={cn(
          "group flex h-full w-full flex-col items-start gap-2 rounded-lg border border-ink/10 bg-white p-2.5 text-left",
          "transition-[background-color,border-color,opacity,transform] duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
          used ? "cursor-not-allowed opacity-40" : "cursor-grab hover:border-ink/25 hover:bg-paper active:cursor-grabbing active:scale-[0.98]",
          isDragging && "opacity-30",
        )}
        {...pointer}
        {...attributes}
        tabIndex={0}
        aria-label={`Add ${definition.label} block`}
      >
        <span className="grid size-7 place-items-center rounded-md bg-paper text-ink/70 transition-colors group-hover:bg-white">
          <Icon className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span className="text-[0.76rem] font-medium leading-tight text-ink">{definition.label}</span>
      </button>
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
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (definition: BlockDefinition) =>
    !needle || definition.label.toLowerCase().includes(needle) || definition.hint.toLowerCase().includes(needle);

  const groups = BLOCK_GROUPS.map((group) => ({
    ...group,
    items: BLOCK_DEFINITIONS.filter((definition) => group.kinds.includes(definition.kind) && matches(definition)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink/10 px-4 pb-3 pt-5">
        <p className="text-[0.95rem] font-medium tracking-[-0.01em] text-ink">Add blocks</p>
        <label className="relative mt-2.5 block">
          <span className="sr-only">Search blocks</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink/40" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks"
            className="h-8 w-full rounded-sw border border-ink/15 bg-paper/60 pl-8 pr-2 text-[0.82rem] text-ink placeholder:text-ink/40 focus:border-ink/40 focus:bg-white focus:outline-none"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {groups.map((group) => (
          <section key={group.label} className="mt-4">
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ink/45">{group.label}</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {group.items.map((definition) => (
                <PaletteTile
                  key={definition.kind}
                  definition={definition}
                  used={Boolean(definition.once) && usedKinds.has(definition.kind)}
                  onAdd={onAdd}
                />
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="mt-6 text-center text-[0.8rem] text-ink/50">No blocks match that search.</p>}
      </div>
    </div>
  );
}
