import { newBlock } from "@/lib/blocks";
import type { Block, BlockKind, Site } from "@/lib/sites";

/*
  Editor state and the reducer that drives it. Kept out of the components so
  the editing rules live in one place: every change to a page goes through
  one of these actions.
*/

/** Brand accents, straight from the design bible. */
export const ACCENTS = [
  { value: "#ff8c88", label: "Coral" },
  { value: "#ffd2bf", label: "Peach" },
  { value: "#edffc0", label: "Lime" },
  { value: "#d9bfff", label: "Lilac" },
  { value: "#bfe9ff", label: "Blue" },
  { value: "#e5ca65", label: "Yellow" },
  { value: "#c2c698", label: "Olive" },
] as const;

export type EditorState = {
  blocks: Block[];
  selectedId: string | null;
  accent: string;
};

export type EditorAction =
  | { type: "insert"; kind: BlockKind; index: number }
  | { type: "move"; from: number; to: number }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "update"; id: string; key: string; value: unknown }
  | { type: "select"; id: string | null }
  | { type: "accent"; value: string }
  | { type: "replace"; state: EditorState };

export function initialState(site: Site): EditorState {
  return { blocks: site.blocks, selectedId: null, accent: site.brand.accent };
}

function clamp(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "insert": {
      const block = newBlock(action.kind);
      const blocks = [...state.blocks];
      blocks.splice(clamp(action.index, blocks.length), 0, block);
      /* Select the new block so the inspector opens on it. */
      return { ...state, blocks, selectedId: block.id };
    }

    case "move": {
      const { from, to } = action;
      if (from === to || from < 0 || from >= state.blocks.length) return state;
      const blocks = [...state.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(clamp(to, blocks.length), 0, moved);
      return { ...state, blocks };
    }

    case "remove": {
      const blocks = state.blocks.filter((block) => block.id !== action.id);
      if (blocks.length === state.blocks.length) return state;
      return {
        ...state,
        blocks,
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      };
    }

    case "duplicate": {
      const index = state.blocks.findIndex((block) => block.id === action.id);
      if (index === -1) return state;
      const source = state.blocks[index];
      const copy: Block = {
        ...newBlock(source.kind),
        props: { ...source.props },
      };
      const blocks = [...state.blocks];
      blocks.splice(index + 1, 0, copy);
      return { ...state, blocks, selectedId: copy.id };
    }

    case "update": {
      const blocks = state.blocks.map((block) =>
        block.id === action.id
          ? { ...block, props: { ...block.props, [action.key]: action.value } }
          : block,
      );
      return { ...state, blocks };
    }

    case "select":
      return { ...state, selectedId: action.id };

    case "accent":
      return { ...state, accent: action.value };

    case "replace":
      return action.state;
  }
}

/** Shape check for state restored from storage, which may be stale or hand-edited. */
export function isEditorState(value: unknown): value is EditorState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<EditorState>;
  return (
    Array.isArray(candidate.blocks) &&
    candidate.blocks.every(
      (block) =>
        typeof block?.id === "string" &&
        typeof block?.kind === "string" &&
        typeof block?.props === "object" &&
        block.props !== null,
    ) &&
    typeof candidate.accent === "string"
  );
}
