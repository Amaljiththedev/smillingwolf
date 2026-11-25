"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Canvas } from "@/components/builder/canvas";
import { Inspector } from "@/components/builder/inspector";
import { Palette } from "@/components/builder/palette";
import { TopBar } from "@/components/builder/top-bar";
import { definitionFor } from "@/lib/blocks";
import { editorReducer, initialState, isEditorState } from "@/lib/editor";
import type { Session } from "@/lib/session";
import type { BlockKind, Site } from "@/lib/sites";
import { cn } from "@/lib/utils";

/*
  The builder. Blocks are dragged from the palette onto the page, reordered
  by their handle, and edited in the inspector.

  Work is kept in this browser (localStorage) so a refresh does not lose it.
  That is a prototype measure: when the database lands, the same state goes
  through a server action instead, and nothing else here changes.
*/

export function Editor({ site, session }: { site: Site; session: Session }) {
  const [state, dispatch] = useReducer(editorReducer, site, initialState);
  const [draggingKind, setDraggingKind] = useState<BlockKind | null>(null);

  const storageKey = `openplan:site:${site.id}`;

  /* Read the saved draft once, after mount, so the server copy and the first
     client render agree and hydration stays clean. */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (isEditorState(parsed)) {
        dispatch({ type: "replace", state: { ...parsed, selectedId: null } });
      }
    } catch {
      /* Corrupt or unavailable storage just means we start from the server copy. */
    }
  }, [storageKey]);

  /* Skip the very first run: on mount this effect would still be holding the
     pre-restore state, and writing it would clobber the saved draft. */
  const savedOnce = useRef(false);
  useEffect(() => {
    if (!savedOnce.current) {
      savedOnce.current = true;
      return;
    }
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ blocks: state.blocks, accent: state.accent, selectedId: null }),
      );
    } catch {
      /* Out of quota or blocked – editing still works, it just will not persist. */
    }
  }, [state.blocks, state.accent, storageKey]);

  const sensors = useSensors(
    /* A small threshold so a click selects a block and a drag moves it. */
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = useMemo(
    () => state.blocks.find((block) => block.id === state.selectedId) ?? null,
    [state.blocks, state.selectedId],
  );

  const usedKinds = useMemo(() => new Set(state.blocks.map((block) => block.kind)), [state.blocks]);

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    setDraggingKind(
      data?.from === "palette"
        ? (data.kind as BlockKind)
        : (state.blocks.find((block) => block.id === event.active.id)?.kind ?? null),
    );
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingKind(null);
    const { active, over } = event;
    if (!over) return;

    /* New block from the palette: drop onto a block to insert above it,
       anywhere else on the page to append. */
    if (active.data.current?.from === "palette") {
      const kind = active.data.current.kind as BlockKind | undefined;
      if (!kind) return;
      const at = state.blocks.findIndex((block) => block.id === over.id);
      dispatch({ type: "insert", kind, index: at === -1 ? state.blocks.length : at });
      return;
    }

    /* Reordering an existing block. */
    if (over.id === "canvas" || active.id === over.id) return;
    const from = state.blocks.findIndex((block) => block.id === active.id);
    const to = state.blocks.findIndex((block) => block.id === over.id);
    if (from === -1 || to === -1) return;
    dispatch({ type: "move", from, to });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingKind(null)}
    >
      <TopBar session={session}>
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/builder"
            className="inline-flex shrink-0 items-center gap-1.5 text-[0.85rem] text-ink/65 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Sites</span>
          </Link>
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-ink/15" />
          <span className="truncate text-[0.9rem] font-medium text-ink">{site.name}</span>
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 md:inline-flex",
              "font-mono text-[0.55rem] uppercase tracking-[0.1em] text-ink/55",
            )}
          >
            <Check className="size-3" aria-hidden="true" />
            Saved in this browser
          </span>
        </div>
      </TopBar>

      <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
        <aside className="hidden w-56 shrink-0 border-r border-ink/10 bg-white md:block">
          <Palette
            usedKinds={usedKinds}
            onAdd={(kind) => dispatch({ type: "insert", kind, index: state.blocks.length })}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <Canvas
            blocks={state.blocks}
            accent={state.accent}
            selectedId={state.selectedId}
            onSelect={(id) => dispatch({ type: "select", id })}
            onDuplicate={(id) => dispatch({ type: "duplicate", id })}
            onRemove={(id) => dispatch({ type: "remove", id })}
          />
        </main>

        <aside className="hidden w-72 shrink-0 border-l border-ink/10 bg-white lg:block">
          <Inspector
            block={selected}
            accent={state.accent}
            onUpdate={(key, value) =>
              selected && dispatch({ type: "update", id: selected.id, key, value })
            }
            onAccent={(value) => dispatch({ type: "accent", value })}
            onClearSelection={() => dispatch({ type: "select", id: null })}
          />
        </aside>
      </div>

      {/* What the cursor carries while dragging */}
      <DragOverlay dropAnimation={null}>
        {draggingKind && (
          <span className="inline-flex items-center gap-2 rounded-sw border border-ink/15 bg-white px-2.5 py-1.5 text-[0.82rem] font-medium text-ink shadow-[0_10px_24px_-10px_rgba(19,23,19,0.45)]">
            {definitionFor(draggingKind).label}
          </span>
        )}
      </DragOverlay>
    </DndContext>
  );
}
