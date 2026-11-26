"use client";

import { useSyncExternalStore } from "react";
import { isBlockKind } from "@/lib/blocks";
import { isEditorState, type EditorState } from "@/lib/editor";
import { themeById } from "@/lib/themes";

/*
  Where the builder keeps its draft for now: this browser's localStorage.
  The full-page preview reads the same key, and listens for changes, so a
  preview open in another tab updates as the page is edited.
  When pages are saved on the server this file is the only one to change.
*/

export function storageKey(siteId: string): string {
  return `openplan:site:${siteId}`;
}

/** Parses a saved draft, dropping any block kinds this version no longer knows. */
export function parseSaved(raw: string | null): EditorState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isEditorState(parsed)) return null;
    return {
      ...parsed,
      theme: themeById(typeof parsed.theme === "string" ? parsed.theme : undefined).id,
      blocks: parsed.blocks.filter((block) => isBlockKind(block.kind)),
      selectedId: null,
    };
  } catch {
    return null;
  }
}

export function readSaved(siteId: string): EditorState | null {
  try {
    return parseSaved(window.localStorage.getItem(storageKey(siteId)));
  } catch {
    return null;
  }
}

export function writeSaved(siteId: string, state: EditorState): void {
  try {
    window.localStorage.setItem(
      storageKey(siteId),
      JSON.stringify({ blocks: state.blocks, accent: state.accent, theme: state.theme, selectedId: null }),
    );
  } catch {
    /* Out of quota or blocked - editing still works, it just will not persist. */
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** The raw saved draft, live. Null on the server and when nothing is saved. */
export function useSavedRaw(siteId: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(storageKey(siteId));
      } catch {
        return null;
      }
    },
    () => null,
  );
}
