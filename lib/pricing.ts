/*
  Pricing used by the Pricing section.
  THE FIGURE BELOW IS A PLACEHOLDER, NOT AN AGREED PRICE.
  While `confirmed` is false the section shows an "Example pricing" tag.
  Replace the number, then set `confirmed: true`.
*/
export const PRICING = {
  confirmed: false,
  currency: "GBP",
  planName: "Per consultation",
  description: "Pay for the consultation sites you run. Each live site is priced on its own.",
  /** Monthly price for each live site. PLACEHOLDER. */
  perSiteMonthly: 250,
  unitLabel: "per site, per month",
  minSites: 1,
  maxSites: 10,
  defaultSites: 2,
  /** Only capabilities named in the hero description. */
  included: [
    "Your brand on your own domain",
    "Modular pages",
    "Interactive masterplan map",
    "Surveys and map comments",
  ],
  ctaLabel: "Book a live demo",
} as const;
