export type NavLink = { label: string; href: `#${string}` };

/* Section anchors. Each section must carry the matching id. */
export const NAV_LINKS: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "The map", href: "#map" },
  { label: "Pricing", href: "#pricing" },
];

export const NAV_CTA: NavLink = { label: "Live demo", href: "#demo" };

/** Separate page, not a section anchor. */
export const NAV_LOGIN = { label: "Log in", href: "/login" } as const;

/** Height of the bar, used as the scroll offset so sections land below it. */
export const NAV_HEIGHT = 72;
