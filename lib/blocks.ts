import {
  CalendarClock,
  CalendarDays,
  FileText,
  Hash,
  Heading1,
  Images,
  LayoutGrid,
  LayoutPanelTop,
  ListChecks,
  ListTree,
  Mail,
  MapIcon,
  MessageCircleQuestion,
  PanelBottom,
  PlaySquare,
  Quote,
  SplitSquareHorizontal,
  Sparkles,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";
import { hasAerial } from "@/lib/map-styles";
import type { Block, BlockKind } from "@/lib/sites";

/*
  The block registry. Every block kind declares its label, its default
  content and the fields the inspector shows. Adding a block type means
  adding one entry here and one branch in the renderer - nothing else.
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

/** An uploaded (or linked) image or document. Images always carry alt text. */
export type Media = { url: string; alt: string; name?: string; size?: number };

/** Fields inside one repeatable item (a gallery photo, an FAQ, a fact...). */
export type SubField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "image" | "file";
};

/** Show a field only while another field has one of these values. */
type When = { when?: { key: string; is: readonly string[] } };

export type Field = (
  | { key: string; label: string; type: "text" | "textarea" | "date" | "url"; help?: string }
  | {
      key: string;
      label: string;
      /** "choice" is a row of buttons for a few short options; "select" a dropdown. */
      type: "select" | "choice";
      options: readonly { value: string; label: string }[];
    }
  | { key: string; label: string; type: "list"; itemLabel: string }
  | { key: string; label: string; type: "image"; help?: string }
  /** A layered SVG masterplan placed by OS grid references (see lib/svg-plan.ts). */
  | { key: string; label: string; type: "svgplan"; help?: string }
  | { key: string; label: string; type: "site"; help?: string }
  | {
      key: string;
      label: string;
      type: "items";
      itemLabel: string;
      fields: readonly SubField[];
      /** Which sub-field names the item in its collapsed row. */
      titleKey: string;
      max?: number;
    }
) &
  When;

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

const EMPTY: Media = { url: "", alt: "" };

export const BLOCK_DEFINITIONS: readonly BlockDefinition[] = [
  /* ---------- Page ---------- */
  {
    kind: "header",
    label: "Header",
    hint: "Site name, logo and page links",
    icon: LayoutPanelTop,
    once: true,
    defaults: {
      title: "Your consultation",
      logo: EMPTY,
      links: ["Overview", "The masterplan", "Have your say"],
      cta: "Have your say",
      animation: "fade",
    },
    fields: [
      { key: "title", label: "Site name", type: "text" },
      { key: "logo", label: "Logo", type: "image", help: "Shown instead of the coloured square. PNG or SVG-like PNG on a clear background works best." },
      { key: "links", label: "Page links", type: "list", itemLabel: "Link" },
      { key: "cta", label: "Button label", type: "text", help: "Leave empty to hide the button." },
    ],
  },
  {
    kind: "hero",
    label: "Hero",
    hint: "Headline, opening paragraph and a big image",
    icon: Heading1,
    defaults: {
      eyebrow: "Public consultation",
      title: "Have your say on the plans",
      body: "We are proposing new homes, workspace and public space. Tell us what you think before the deadline.",
      cta: "Take the survey",
      image: EMPTY,
      layout: "split",
      shape: "landscape",
      overlay: "dark",
      height: "tall",
      animation: "rise",
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Headline", type: "text" },
      { key: "body", label: "Paragraph", type: "textarea" },
      { key: "cta", label: "Button label", type: "text" },
      { key: "image", label: "Image", type: "image", help: "A CGI or site photo. Landscape, at least 1600px wide." },
      {
        key: "layout",
        label: "Image position",
        type: "choice",
        options: [
          { value: "split", label: "Right" },
          { value: "split-left", label: "Left" },
          { value: "cover", label: "Background" },
          { value: "plain", label: "None" },
        ],
      },
      {
        key: "shape",
        label: "Image shape",
        type: "choice",
        when: { key: "layout", is: ["split", "split-left"] },
        options: [
          { value: "landscape", label: "Wide" },
          { value: "square", label: "Square" },
          { value: "portrait", label: "Tall" },
        ],
      },
      {
        key: "overlay",
        label: "Text on the image",
        type: "choice",
        when: { key: "layout", is: ["cover"] },
        options: [
          { value: "dark", label: "Light text" },
          { value: "light", label: "Dark text" },
        ],
      },
      {
        key: "height",
        label: "Height",
        type: "choice",
        when: { key: "layout", is: ["cover"] },
        options: [
          { value: "short", label: "Short" },
          { value: "tall", label: "Tall" },
          { value: "screen", label: "Full screen" },
        ],
      },
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
      { key: "body", label: "Body", type: "textarea", help: "A blank line starts a new paragraph." },
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

  /* ---------- Showcase ---------- */
  {
    kind: "gallery",
    label: "Gallery",
    hint: "CGIs, photos and plans in a grid",
    icon: Images,
    defaults: {
      title: "Visualising the scheme",
      images: [
        { image: EMPTY, caption: "View from the high street" },
        { image: EMPTY, caption: "The new square" },
        { image: EMPTY, caption: "Homes along the park" },
      ],
      animation: "rise",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      {
        key: "images",
        label: "Images",
        type: "items",
        itemLabel: "Image",
        titleKey: "caption",
        max: 12,
        fields: [
          { key: "image", label: "Image", type: "image" },
          { key: "caption", label: "Caption", type: "text" },
        ],
      },
    ],
  },
  {
    kind: "compare",
    label: "Before and after",
    hint: "Drag a slider between today and the proposal",
    icon: SplitSquareHorizontal,
    defaults: {
      title: "How the street could change",
      before: EMPTY,
      after: EMPTY,
      beforeLabel: "Today",
      afterLabel: "Proposed",
      caption: "Drag the handle to compare.",
      animation: "scale",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "before", label: "Before image", type: "image" },
      { key: "after", label: "After image", type: "image", help: "Use the same viewpoint and size as the before image." },
      { key: "beforeLabel", label: "Before label", type: "text" },
      { key: "afterLabel", label: "After label", type: "text" },
      { key: "caption", label: "Caption", type: "text" },
    ],
  },
  {
    kind: "video",
    label: "Video",
    hint: "YouTube, Vimeo or a video file",
    icon: PlaySquare,
    defaults: {
      title: "Walk through the plans",
      url: "",
      caption: "A three-minute fly-through of the masterplan.",
      animation: "rise",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "url", label: "Video link", type: "url", help: "Paste a YouTube or Vimeo link, or a link to an .mp4 file." },
      { key: "caption", label: "Caption", type: "text" },
    ],
  },
  {
    kind: "facts",
    label: "Key facts",
    hint: "Big numbers: homes, trees, jobs",
    icon: Hash,
    defaults: {
      title: "The scheme in numbers",
      facts: [
        { value: "450", label: "new homes" },
        { value: "35%", label: "affordable" },
        { value: "2.4 ha", label: "public open space" },
        { value: "120", label: "new trees" },
      ],
      animation: "rise",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      {
        key: "facts",
        label: "Facts",
        type: "items",
        itemLabel: "Fact",
        titleKey: "value",
        max: 8,
        fields: [
          { key: "value", label: "Number", type: "text" },
          { key: "label", label: "Label", type: "text" },
        ],
      },
    ],
  },
  {
    kind: "proposals",
    label: "Proposal cards",
    hint: "One card per part of the scheme",
    icon: LayoutGrid,
    defaults: {
      title: "What we are proposing",
      intro: "The plans are made up of three parts. Tell us what you think of each.",
      cards: [
        { image: EMPTY, title: "New homes", body: "450 homes, a mix of flats and family houses." },
        { image: EMPTY, title: "A new square", body: "Space for markets, events and somewhere to sit." },
        { image: EMPTY, title: "Better streets", body: "Wider pavements, crossings and cycle lanes." },
      ],
      animation: "rise",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "intro", label: "Intro", type: "textarea" },
      {
        key: "cards",
        label: "Cards",
        type: "items",
        itemLabel: "Card",
        titleKey: "title",
        max: 9,
        fields: [
          { key: "image", label: "Image", type: "image" },
          { key: "title", label: "Title", type: "text" },
          { key: "body", label: "Text", type: "textarea" },
        ],
      },
    ],
  },
  {
    kind: "features",
    label: "Feature list",
    hint: "Short benefits with a number each",
    icon: Sparkles,
    defaults: {
      title: "What the scheme brings",
      features: [
        { title: "Homes people can afford", body: "35% of the new homes will be affordable." },
        { title: "Green space for everyone", body: "A new park open to the whole town." },
        { title: "Local jobs", body: "Space for shops, cafes and small businesses." },
      ],
      animation: "rise",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      {
        key: "features",
        label: "Features",
        type: "items",
        itemLabel: "Feature",
        titleKey: "title",
        max: 9,
        fields: [
          { key: "title", label: "Title", type: "text" },
          { key: "body", label: "Text", type: "textarea" },
        ],
      },
    ],
  },
  {
    kind: "team",
    label: "Team and partners",
    hint: "Who is behind the scheme",
    icon: Users,
    defaults: {
      title: "Who is involved",
      people: [
        { logo: EMPTY, name: "Example Homes", role: "Developer" },
        { logo: EMPTY, name: "Studio Architects", role: "Architect" },
        { logo: EMPTY, name: "Market Hill Council", role: "Landowner" },
      ],
      animation: "fade",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      {
        key: "people",
        label: "People or organisations",
        type: "items",
        itemLabel: "Partner",
        titleKey: "name",
        max: 12,
        fields: [
          { key: "logo", label: "Logo or photo", type: "image" },
          { key: "name", label: "Name", type: "text" },
          { key: "role", label: "Role", type: "text" },
        ],
      },
    ],
  },
  {
    kind: "quote",
    label: "Quote",
    hint: "A pull quote from a resident or partner",
    icon: Quote,
    defaults: {
      quote: "We want this to be a place local people are proud of, so we are starting by listening.",
      name: "Alex Morgan",
      role: "Project lead",
      photo: EMPTY,
      animation: "fade",
    },
    fields: [
      { key: "quote", label: "Quote", type: "textarea" },
      { key: "name", label: "Name", type: "text" },
      { key: "role", label: "Role", type: "text" },
      { key: "photo", label: "Photo", type: "image" },
    ],
  },

  /* ---------- Information ---------- */
  {
    kind: "keydate",
    label: "Key date",
    hint: "Closing date with a countdown",
    icon: CalendarClock,
    defaults: {
      label: "Consultation closes",
      date: "2027-03-31",
      body: "Make sure you have your say before then.",
      animation: "scale",
    },
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "date", label: "Date", type: "date" },
      { key: "body", label: "Note", type: "text" },
    ],
  },
  {
    kind: "timeline",
    label: "Timeline",
    hint: "Stages of the consultation",
    icon: CalendarDays,
    defaults: {
      title: "What happens next",
      stages: ["Consultation opens", "Drop-in event", "Consultation closes", "Application submitted"],
      current: "1",
      animation: "slide",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "stages", label: "Stages", type: "list", itemLabel: "Stage" },
      { key: "current", label: "Current stage number", type: "text", help: "Stages up to this one show as done." },
    ],
  },
  {
    kind: "faq",
    label: "FAQ",
    hint: "Questions that open to show the answer",
    icon: MessageCircleQuestion,
    defaults: {
      title: "Frequently asked questions",
      questions: [
        { question: "When will building start?", answer: "If planning permission is granted, work could start in spring 2028." },
        { question: "Will there be more traffic?", answer: "A transport assessment is part of the application. Most new trips are expected to be on foot, by bike or by bus." },
        { question: "How do I comment?", answer: "Fill in the survey on this page, drop a pin on the map, or email the team." },
      ],
      animation: "rise",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      {
        key: "questions",
        label: "Questions",
        type: "items",
        itemLabel: "Question",
        titleKey: "question",
        max: 20,
        fields: [
          { key: "question", label: "Question", type: "text" },
          { key: "answer", label: "Answer", type: "textarea" },
        ],
      },
    ],
  },
  {
    kind: "documents",
    label: "Documents",
    hint: "Exhibition boards and reports to download",
    icon: FileText,
    defaults: {
      title: "Documents",
      files: [
        { title: "Exhibition boards", file: EMPTY },
        { title: "Design and access summary", file: EMPTY },
      ],
      animation: "rise",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      {
        key: "files",
        label: "Files",
        type: "items",
        itemLabel: "Document",
        titleKey: "title",
        max: 20,
        fields: [
          { key: "title", label: "Title", type: "text" },
          { key: "file", label: "File (PDF)", type: "file" },
        ],
      },
    ],
  },
  {
    kind: "contact",
    label: "Contact",
    hint: "Email, phone, freepost and events",
    icon: Mail,
    defaults: {
      title: "Get in touch",
      email: "consultation@example.gov.uk",
      phone: "0800 000 0000",
      address: "Freepost MARKET HILL CONSULTATION",
      hours: "Phone line open Monday to Friday, 9am to 5pm.",
      animation: "rise",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "address", label: "Postal address", type: "textarea" },
      { key: "hours", label: "Opening hours or note", type: "text" },
    ],
  },

  /* ---------- Engagement ---------- */
  {
    kind: "map",
    label: "Masterplan map",
    hint: "Plan with comment pins",
    icon: MapIcon,
    defaults: {
      title: "The masterplan",
      caption: "Drop a pin to comment on a specific spot.",
      pins: "4",
      basemap: "streets",
      view: "flat",
      reach: "site",
      animation: "scale",
    },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "caption", label: "Caption", type: "text" },
      {
        key: "site",
        label: "Site",
        type: "site",
        help: "Where the scheme is. The map opens here, the boundary is highlighted, and paths, roads and buildings are drawn from the map data.",
      },
      {
        key: "plan",
        label: "Masterplan drawing (optional)",
        type: "svgplan",
        help: "For the proposed scheme: a layered SVG from the architects. Each layer (boundary, buildings, landscape and so on) becomes a switch visitors can turn on and off.",
      },
      {
        key: "reach",
        label: "Map area",
        type: "choice",
        options: [
          { value: "site", label: "Keep to the site" },
          { value: "wide", label: "Wider area" },
        ],
      },
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
      {
        key: "basemap",
        label: "Base map",
        type: "select",
        options: [
          { value: "streets", label: "Streets" },
          { value: "terrain", label: "Terrain" },
          ...(hasAerial ? [{ value: "aerial", label: "Aerial, soft" }] : []),
        ],
      },
      {
        key: "view",
        label: "View",
        type: "select",
        options: [
          { value: "flat", label: "Flat, from above" },
          { value: "3d", label: "3D, with buildings" },
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
];

/** Palette sections, in the order a page is usually built. */
export const BLOCK_GROUPS: { label: string; icon: LucideIcon; kinds: BlockKind[] }[] = [
  { label: "Page", icon: LayoutPanelTop, kinds: ["header", "hero", "text", "footer"] },
  { label: "Showcase", icon: Images, kinds: ["gallery", "compare", "video", "facts", "proposals", "features", "team", "quote"] },
  { label: "Information", icon: ListTree, kinds: ["keydate", "timeline", "faq", "documents", "contact"] },
  { label: "Engagement", icon: MapIcon, kinds: ["map", "survey"] },
];

export function isBlockKind(value: unknown): value is BlockKind {
  return BLOCK_DEFINITIONS.some((definition) => definition.kind === value);
}

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
    props: structuredClone(definitionFor(kind).defaults),
  };
}

/** A blank item for an "items" field, so new rows start with every key. */
export function emptyItem(field: Extract<Field, { type: "items" }>, index: number): Record<string, unknown> {
  return Object.fromEntries(
    field.fields.map((sub) => [
      sub.key,
      sub.type === "image" || sub.type === "file" ? { ...EMPTY } : sub.key === field.titleKey ? `${field.itemLabel} ${index + 1}` : "",
    ]),
  );
}

/* Safe readers - props is an open bag, so never trust a key is there. */

export function readText(props: Record<string, unknown>, key: string, fallback = ""): string {
  const value = props[key];
  return typeof value === "string" ? value : fallback;
}

export function readList(props: Record<string, unknown>, key: string): string[] {
  const value = props[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function readMedia(props: Record<string, unknown>, key: string): Media {
  const value = props[key];
  if (typeof value !== "object" || value === null) return { ...EMPTY };
  const media = value as Partial<Media>;
  return {
    url: typeof media.url === "string" ? media.url : "",
    alt: typeof media.alt === "string" ? media.alt : "",
    name: typeof media.name === "string" ? media.name : undefined,
    size: typeof media.size === "number" ? media.size : undefined,
  };
}

export function readItems(props: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = props[key];
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
}

export function readAnimation(props: Record<string, unknown>): AnimationName {
  const value = props.animation;
  return ANIMATIONS.some((animation) => animation.value === value) ? (value as AnimationName) : "none";
}

/** Only http(s) links and site-relative paths are ever rendered. */
export function safeUrl(value: string): string {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

/* ---------- Showing and hiding parts of a block ---------- */

/** Every content field can be hidden from the page without losing what was typed. */
export function canHide(field: Field): boolean {
  return field.type !== "select" && field.type !== "choice";
}

export function hiddenKeys(props: Record<string, unknown>): string[] {
  return readList(props, "hidden");
}

export function isShown(props: Record<string, unknown>, key: string): boolean {
  return !hiddenKeys(props).includes(key);
}

/** Whether a field applies to the block's current settings (see Field["when"]). */
export function fieldApplies(field: Field, props: Record<string, unknown>, defaults: Record<string, unknown> = {}): boolean {
  if (!field.when) return true;
  const fallback = typeof defaults[field.when.key] === "string" ? (defaults[field.when.key] as string) : "";
  return field.when.is.includes(readText(props, field.when.key, fallback));
}

/** Props as the page should see them: hidden parts blanked, so renderers simply skip them. */
export function visibleProps(props: Record<string, unknown>): Record<string, unknown> {
  const hidden = hiddenKeys(props);
  if (hidden.length === 0) return props;
  const next: Record<string, unknown> = { ...props };
  for (const key of hidden) {
    const value = props[key];
    next[key] = typeof value === "string" ? "" : Array.isArray(value) ? [] : { ...EMPTY };
  }
  return next;
}

/* ---------- Block style (every block) ---------- */

export const BLOCK_STYLE = {
  background: [
    { value: "none", label: "White" },
    { value: "paper", label: "Warm grey" },
    { value: "tint", label: "Brand tint" },
  ],
  spacing: [
    { value: "compact", label: "Compact" },
    { value: "normal", label: "Normal" },
    { value: "roomy", label: "Roomy" },
  ],
  align: [
    { value: "left", label: "Left" },
    { value: "center", label: "Centre" },
  ],
  devices: [
    { value: "phone", label: "Phone" },
    { value: "tablet", label: "Tablet" },
    { value: "desktop", label: "Desktop" },
  ],
} as const;

export type BlockStyle = {
  background: (typeof BLOCK_STYLE.background)[number]["value"];
  spacing: (typeof BLOCK_STYLE.spacing)[number]["value"];
  align: (typeof BLOCK_STYLE.align)[number]["value"];
  /** Devices the block is hidden on. */
  hideOn: (typeof BLOCK_STYLE.devices)[number]["value"][];
};

function pick<T extends string>(value: unknown, options: readonly { value: T }[], fallback: T): T {
  return options.some((option) => option.value === value) ? (value as T) : fallback;
}

export function readStyle(props: Record<string, unknown>): BlockStyle {
  const raw = (typeof props.style === "object" && props.style !== null ? props.style : {}) as Record<string, unknown>;
  const hideOn = Array.isArray(raw.hideOn) ? raw.hideOn : [];
  return {
    background: pick(raw.background, BLOCK_STYLE.background, "none"),
    spacing: pick(raw.spacing, BLOCK_STYLE.spacing, "normal"),
    align: pick(raw.align, BLOCK_STYLE.align, "left"),
    hideOn: BLOCK_STYLE.devices.map((d) => d.value).filter((d) => hideOn.includes(d)),
  };
}
