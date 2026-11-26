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
import { Check, Plus, SlidersHorizontal } from "lucide-react";
import { SiteNav } from "@/components/dashboard/site-nav";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Canvas } from "@/components/builder/canvas";
import { Inspector } from "@/components/builder/inspector";
import { Palette } from "@/components/builder/palette";
import { TopBar } from "@/components/builder/top-bar";
import { Tour, useTourSeen } from "@/components/builder/tour";
import { definitionFor } from "@/lib/blocks";
import { editorReducer, initialState } from "@/lib/editor";
import { readSaved, writeSaved } from "@/lib/page-store";
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

  /* Which panel is open as a sheet on screens too narrow for the side panels. */
  const [sheet, setSheet] = useState<"palette" | "inspector" | null>(null);

  /* Guided tour: opens by itself the first time this user opens the builder, and from the Tour button after that. */
  const tourSeen = useTourSeen(session.email);
  const [tourAgain, setTourAgain] = useState(false);
  const tourOpen = tourAgain || !tourSeen.seen;
  function startTour() {
    setSheet(null);
    /* Page settings (with the themes) show when nothing is selected. */
    dispatch({ type: "select", id: null });
    setTourAgain(true);
  }
  function endTour() {
    tourSeen.markSeen();
    setTourAgain(false);
  }

  /* Read the saved draft once, after mount, so the server copy and the first
     client render agree and hydration stays clean. */
  useEffect(() => {
    const saved = readSaved(site.id);
    if (saved) dispatch({ type: "replace", state: saved });
  }, [site.id]);

  /* Skip the very first run: on mount this effect would still be holding the
     pre-restore state, and writing it would clobber the saved draft. */
  const savedOnce = useRef(false);
  useEffect(() => {
    if (!savedOnce.current) {
      savedOnce.current = true;
      return;
    }
    writeSaved(site.id, state);
  }, [state, site.id]);

  const sensors = useSensors(
    /* A small threshold so a click selects a block and a drag moves it. */
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selected = useMemo(
    () => state.blocks.find((block) => block.id === state.selectedId) ?? null,
    [state.blocks, state.selectedId],
  );

  const selectedIndex = selected ? state.blocks.indexOf(selected) : -1;
  const position = { index: selectedIndex, count: state.blocks.length };

  function moveBlock(id: string, step: -1 | 1) {
    const from = state.blocks.findIndex((block) => block.id === id);
    if (from === -1) return;
    dispatch({ type: "move", from, to: from + step });
  }

  /* Alt + Up / Down moves the selected block, wherever focus is (except text fields). */
  const moveSelected = useRef<(step: -1 | 1) => void>(() => {});
  useEffect(() => {
    moveSelected.current = (step) => {
      if (state.selectedId) moveBlock(state.selectedId, step);
    };
  });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        !event.altKey ||
        (event.key !== "ArrowUp" && event.key !== "ArrowDown")
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      event.preventDefault();
      moveSelected.current(event.key === "ArrowUp" ? -1 : 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const usedKinds = useMemo(
    () => new Set(state.blocks.map((block) => block.kind)),
    [state.blocks],
  );

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    setDraggingKind(
      data?.from === "palette"
        ? (data.kind as BlockKind)
        : (state.blocks.find((block) => block.id === event.active.id)?.kind ??
            null),
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
      dispatch({
        type: "insert",
        kind,
        index: at === -1 ? state.blocks.length : at,
      });
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
      /* A fixed id keeps dnd-kit's accessibility ids the same on server and client. */
      id="openplan-builder"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingKind(null)}
    >
      <TopBar session={session}>
        <SiteNav
          site={site}
          extra={
            <span
              title="Saved in this browser"
              className={cn(
                "hidden shrink-0 items-center gap-1 rounded-full bg-lime/60 px-2 py-0.5 lg:inline-flex",
                "text-[0.72rem] text-ink/70",
              )}
            >
              <Check className="size-3" aria-hidden="true" />
              Saved
            </span>
          }
        />
      </TopBar>

      <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
        <aside
          data-tour="palette"
          className="hidden w-60 shrink-0 border-r border-ink/10 bg-white md:block"
        >
          <Palette
            usedKinds={usedKinds}
            onAdd={(kind) =>
              dispatch({ type: "insert", kind, index: state.blocks.length })
            }
          />
        </aside>

        <main data-tour="canvas" className="min-w-0 flex-1">
          <Canvas
            siteId={site.id}
            blocks={state.blocks}
            accent={state.accent}
            theme={state.theme}
            selectedId={state.selectedId}
            onSelect={(id) => {
              dispatch({ type: "select", id });
              /* On narrower screens the inspector is a sheet; open it on select. */
              if (id && window.matchMedia("(max-width: 1023px)").matches)
                setSheet("inspector");
            }}
            onDuplicate={(id) => dispatch({ type: "duplicate", id })}
            onRemove={(id) => dispatch({ type: "remove", id })}
            onMove={moveBlock}
            onTour={startTour}
          />
        </main>

        <aside
          data-tour="inspector"
          className="hidden w-80 shrink-0 border-l border-ink/10 bg-white lg:block"
        >
          <Inspector
            block={selected}
            accent={state.accent}
            theme={state.theme}
            onTheme={(id) => dispatch({ type: "theme", id })}
            siteId={site.id}
            position={position}
            onMove={(step) => selected && moveBlock(selected.id, step)}
            onUpdate={(key, value) =>
              selected &&
              dispatch({ type: "update", id: selected.id, key, value })
            }
            onAccent={(value) => dispatch({ type: "accent", value })}
            onClearSelection={() => dispatch({ type: "select", id: null })}
          />
        </aside>
      </div>

      {/* Narrow screens: the palette and inspector open as bottom sheets */}
      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center gap-2 lg:hidden">
        <button
          type="button"
          data-tour="palette-mobile"
          onClick={() => setSheet("palette")}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[0.85rem] font-medium text-white shadow-lg md:hidden"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add block
        </button>
        <button
          type="button"
          data-tour="inspector-mobile"
          onClick={() => setSheet("inspector")}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 text-[0.85rem] font-medium text-ink shadow-lg"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {selected
            ? `Edit ${definitionFor(selected.kind).label.toLowerCase()}`
            : "Page settings"}
        </button>
      </div>

      {sheet && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={sheet === "palette" ? "Add blocks" : "Edit block"}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSheet(null)}
            className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[78svh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-20px_50px_-20px_rgba(19,23,19,0.4)]">
            <span
              aria-hidden="true"
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-ink/15"
            />
            <div className="min-h-0 flex-1">
              {sheet === "palette" ? (
                <Palette
                  usedKinds={usedKinds}
                  onAdd={(kind) => {
                    dispatch({
                      type: "insert",
                      kind,
                      index: state.blocks.length,
                    });
                    setSheet("inspector");
                  }}
                />
              ) : (
                <Inspector
                  block={selected}
                  accent={state.accent}
                  theme={state.theme}
                  onTheme={(id) => dispatch({ type: "theme", id })}
                  siteId={site.id}
                  position={position}
                  onMove={(step) => selected && moveBlock(selected.id, step)}
                  onUpdate={(key, value) =>
                    selected &&
                    dispatch({ type: "update", id: selected.id, key, value })
                  }
                  onAccent={(value) => dispatch({ type: "accent", value })}
                  onClearSelection={() =>
                    dispatch({ type: "select", id: null })
                  }
                  onClose={() => setSheet(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <Tour open={tourOpen} onClose={endTour} />

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
