/*
  One layout system for every section.
  - Gutters match smilingwolf.co.uk: 10px below 810px, 20px above.
  - Content fills the screen with only the gutters as breathing room.
  - Two-column sections share one equal-width grid.
*/

/** Side gutters. */
export const GUTTER = "px-4 min-[810px]:px-8 xl:px-12";

/** Centred container – near full width, gutters do the rest. */
export const CONTAINER = "mx-auto max-w-[90rem]";

/** Vertical rhythm between sections. */
export const SECTION_Y = "py-8 md:py-12";

/** Text column + visual column. Stacks below 1024px. */
export const SPLIT = "grid grid-cols-[minmax(0,1fr)] items-center gap-6 lg:grid-cols-2 lg:gap-12";

/** Widest a visual may grow inside its column. */
export const VISUAL_MAX = "max-w-[48rem]";
