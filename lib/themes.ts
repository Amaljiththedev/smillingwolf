import type { CSSProperties } from "react";

/*
  Page themes. A theme is a full look for a consultation site: text and
  background colours, two accent colours, a type pairing and corner style.

  Themes work by overriding the design tokens the blocks already use
  (--sw-ink, --sw-paper, --color-white, --radius-*, --font-display) on the
  page wrapper only, so every block picks the theme up with no per-block code
  and the builder's own interface is never affected.

  The accent can still be changed after picking a theme (Page settings >
  Brand colour); text on accent-coloured surfaces switches between dark and
  light automatically so it stays readable.
*/

export type FontPairing = "studio" | "editorial" | "modern" | "classic";
export type Corners = "sharp" | "soft" | "round";

export type Theme = {
  id: string;
  name: string;
  /** One line for the picker. */
  mood: string;
  colors: {
    /** Main text (also lines and outlines at low opacity). */
    text: string;
    /** Page background. */
    page: string;
    /** Soft panels and placeholders. */
    surface: string;
    /** Buttons, highlights, map boundary. */
    accent: string;
    /** A second colour for number badges, key dates and tints. */
    accent2: string;
  };
  font: FontPairing;
  corners: Corners;
};

export const THEMES: readonly Theme[] = [
  {
    id: "studio",
    name: "Studio",
    mood: "Clean, warm white, the Smiling Wolf look",
    colors: { text: "#131713", page: "#ffffff", surface: "#f7f3f0", accent: "#ff8c88", accent2: "#edffc0" },
    font: "studio",
    corners: "soft",
  },
  {
    id: "civic",
    name: "Civic",
    mood: "Trustworthy navy and sunshine, council-friendly",
    colors: { text: "#102a4c", page: "#ffffff", surface: "#eef3f9", accent: "#ffd166", accent2: "#bfe0ff" },
    font: "modern",
    corners: "sharp",
  },
  {
    id: "garden",
    name: "Garden",
    mood: "Fresh greens for parks and landscape-led schemes",
    colors: { text: "#1c2b1e", page: "#fbfcf7", surface: "#eef3e4", accent: "#b9e07c", accent2: "#f7c9a6" },
    font: "editorial",
    corners: "round",
  },
  {
    id: "terracotta",
    name: "Terracotta",
    mood: "Warm brick and clay, good for heritage and town centres",
    colors: { text: "#2d1a12", page: "#fffaf5", surface: "#f6ebe1", accent: "#f2a07b", accent2: "#f4d98c" },
    font: "classic",
    corners: "soft",
  },
  {
    id: "coastal",
    name: "Coastal",
    mood: "Sea blues and coral for waterfronts",
    colors: { text: "#0e2a3b", page: "#ffffff", surface: "#e9f5f6", accent: "#7fd6d2", accent2: "#ffb4a2" },
    font: "modern",
    corners: "round",
  },
  {
    id: "lilac",
    name: "Lilac",
    mood: "Soft and friendly, for community-led projects",
    colors: { text: "#24193a", page: "#fdfcff", surface: "#f3eefb", accent: "#d9bfff", accent2: "#ffd2bf" },
    font: "editorial",
    corners: "round",
  },
  {
    id: "sandstone",
    name: "Sandstone",
    mood: "Calm neutrals with a gold accent",
    colors: { text: "#2a2620", page: "#fcfaf6", surface: "#f2ede3", accent: "#e5ca65", accent2: "#c2c698" },
    font: "classic",
    corners: "sharp",
  },
  {
    id: "night",
    name: "Night",
    mood: "Dark and bold, with neon lime",
    colors: { text: "#f1efe8", page: "#141814", surface: "#1f241f", accent: "#c9f26b", accent2: "#8fd3ff" },
    font: "studio",
    corners: "soft",
  },
];

export const DEFAULT_THEME = THEMES[0];

export function themeById(id: string | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}

export const FONT_LABELS: Record<FontPairing, string> = {
  studio: "Bagoss",
  editorial: "Fraunces + DM Sans",
  modern: "Space Grotesk + Manrope",
  classic: "Newsreader + Manrope",
};

/* Heading and body faces. The variables come from next/font in app/layout.tsx. */
const FONTS: Record<FontPairing, { heading: string; body: string }> = {
  studio: { heading: "var(--font-display)", body: "var(--font-display)" },
  editorial: { heading: "var(--font-fraunces), Georgia, serif", body: "var(--font-dm-sans), system-ui, sans-serif" },
  modern: { heading: "var(--font-space-grotesk), system-ui, sans-serif", body: "var(--font-manrope), system-ui, sans-serif" },
  classic: { heading: "var(--font-newsreader), Georgia, serif", body: "var(--font-manrope), system-ui, sans-serif" },
};

const RADII: Record<Corners, { sw: string; md: string; lg: string; xl: string; xxl: string }> = {
  sharp: { sw: "0px", md: "2px", lg: "2px", xl: "3px", xxl: "4px" },
  soft: { sw: "4px", md: "6px", lg: "8px", xl: "12px", xxl: "16px" },
  round: { sw: "999px", md: "10px", lg: "14px", xl: "20px", xxl: "28px" },
};

/** Relative luminance (WCAG) of a #rrggbb colour. */
function luminance(hex: string): number {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!value) return 1;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Dark or white text, whichever reads better on this colour. */
export function textOn(hex: string): string {
  const l = luminance(hex);
  const contrastDark = (l + 0.05) / (luminance("#131713") + 0.05);
  const contrastLight = (1 + 0.05) / (l + 0.05);
  return contrastDark >= contrastLight ? "#131713" : "#ffffff";
}

/** The CSS variables a page wrapper sets to wear a theme. */
export function themeStyle(theme: Theme, accent: string): CSSProperties {
  const fonts = FONTS[theme.font];
  const radii = RADII[theme.corners];
  return {
    "--sw-ink": theme.colors.text,
    "--sw-paper": theme.colors.surface,
    "--color-white": theme.colors.page,
    "--t-accent": accent,
    "--t-accent-ink": textOn(accent),
    "--t-accent-2": theme.colors.accent2,
    "--t-accent-2-ink": textOn(theme.colors.accent2),
    "--t-heading": fonts.heading,
    "--font-display": fonts.body,
    "--radius": radii.sw,
    "--radius-md": radii.md,
    "--radius-lg": radii.lg,
    "--radius-xl": radii.xl,
    "--radius-2xl": radii.xxl,
    backgroundColor: theme.colors.page,
    color: theme.colors.text,
  } as CSSProperties;
}
