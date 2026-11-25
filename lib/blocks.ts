import {
  CalendarDays,
  Heading1,
  LayoutPanelTop,
  ListChecks,
  MapIcon,
  PanelBottom,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { Block, BlockKind } from "@/lib/sites";

/*
  The block registry. Every block kind declares its label, its default
  content and the fields the inspector shows. Adding a block type means
  adding one entry here and one branch in the renderer – nothing else.
*/

/** Pre-made entrance animations, applied per block. */
export const ANIMATIONS = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade in" },
  { value: "rise", label: "Rise up" },
  { value: "slide", label: "Slide in" },
  { value: "scale", label: "Scale up" },
] as const;

export type AnimationName = (typeof ANIMATIONS)[number]["value"];

export type Field =
  | { key: string; label: string; type: "text" | "textarea" }
  | {
      key: string;
      label: string;
      type: "select";
      options: readonly { value: string; label: string }[];
    }
  | { key: string; label: string; type: "list"; itemLabel: string };

export type BlockDefinition = {
  kind: BlockKind;
  label: string;
  /** One line in the palette, so it is clear what the block is for. */
  hint: string;
  icon: LucideIcon;
  defaults: Record<string, unknown>;
  fields: readonly Field[];
  /** Blocks that belong once per page; the palette greys them out after one. */
  once?: boolean;
};

export const BLOCK_DEFINITIONS: readonly BlockDefinition[] = [
  {
    kind: "header",
    label: "Header",
    hint: "Site name and page links",
    icon: LayoutPanelTop,
    once: true,
    defaults: {
      title: "Your consultation",
      links: ["Overview", "The masterplan", "Have your say"],
      animation: "fade",
    },
    fields: [
      { key: "title", label: "Site name", type: "text" },
      { key: "links", label: "Page links", type: "list", itemLabel: "Link" },
    ],
  },
  {
    kind: "hero",
    label: "Hero",
    hint: "Headline and opening paragraph",
    icon: Heading1,
    defaults: {
      eyebrow: "Public consultation",
      title: "Have your say on the plans",
      body: "We are proposing new homes, workspace and public space. Tell us what you think before the deadline.",
      cta: "Take the survey",
      animation: "rise",
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Headline", type: "text" },
      { key: "body", label: "Paragraph", type: "textarea" },
      { key: "cta", label: "Button label", type: "text" },
    ],
  },
  {
    kind: "text",
    label: "Text",
    hint: "A heading and body copy",
    icon: Type,
    defaults: {
      title: "About the proposals",
      body: "Describe the scheme, who is behind it and what is changing. Keep it plain so everyone can follow it.",
      animation: "rise",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "body", label: "Body", type: "textarea" },
    ],
  },
  {
    kind: "map",
    label: "Masterplan map",
    hint: "Plan with comment pins",
    icon: MapIcon,
    defaults: {
      title: "The masterplan",
      caption: "Drop a pin to comment on a specific spot.",
      pins: "4",
      animation: "scale",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "caption", label: "Caption", type: "text" },
      {
        key: "pins",
        label: "Comment pins",
        type: "select",
        options: [
          { value: "0", label: "None" },
          { value: "2", label: "Two" },
          { value: "4", label: "Four" },
        ],
      },
    ],
  },
  {
    kind: "survey",
    label: "Survey",
    hint: "A question with answer options",
    icon: ListChecks,
    defaults: {
      question: "How would you travel to the new park?",
      answers: ["Walk", "Cycle", "Bus", "Car"],
      animation: "rise",
    },
    fields: [
      { key: "question", label: "Question", type: "text" },
      { key: "answers", label: "Answers", type: "list", itemLabel: "Answer" },
    ],
  },
  {
    kind: "timeline",
    label: "Timeline",
    hint: "Stages of the consultation",
    icon: CalendarDays,
    defaults: {
      title: "What happens next",
      stages: [
        "Consultation opens",
        "Drop-in event",
        "Consultation closes",
        "Application submitted",
      ],
      animation: "slide",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "stages", label: "Stages", type: "list", itemLabel: "Stage" },
    ],
  },
  {
    kind: "footer",
    label: "Footer",
    hint: "Contact details and small print",
    icon: PanelBottom,
    once: true,
    defaults: {
      contact: "consultation@example.gov.uk",
      note: "This consultation closes on 31 March.",
      animation: "fade",
    },
    fields: [
      { key: "contact", label: "Contact", type: "text" },
      { key: "note", label: "Small print", type: "text" },
    ],
  },
];

export function definitionFor(kind: BlockKind): BlockDefinition {
  const found = BLOCK_DEFINITIONS.find((definition) => definition.kind === kind);
  if (!found) throw new Error(`No block definition for "${kind}"`);
  return found;
}

/** Ids only need to be unique inside one page. */
export function newBlock(kind: BlockKind): Block {
  return {
    id: `${kind}-${Math.random().toString(36).slice(2, 9)}`,
    kind,
    props: { ...definitionFor(kind).defaults },
  };
}

/* Safe readers – props is an open bag, so never trust a key is there. */

export function readText(props: Record<string, unknown>, key: string, fallback = ""): string {
  const value = props[key];
  return typeof value === "string" ? value : fallback;
}

export function readList(props: Record<string, unknown>, key: string): string[] {
  const value = props[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function readAnimation(props: Record<string, unknown>): AnimationName {
  const value = props.animation;
  return ANIMATIONS.some((animation) => animation.value === value)
    ? (value as AnimationName)
    : "none";
}
