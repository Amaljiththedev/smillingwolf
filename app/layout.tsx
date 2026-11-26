import type { Metadata } from "next";
import { DM_Sans, Fraunces, Manrope, Newsreader, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { PRODUCT } from "@/lib/brand";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import "./globals.css";

// Bagoss Standard: Smiling Wolf's licensed web font (Displaay web licence).
// The licence covers named domains and a monthly visitor cap – check it before launch.
const bagoss = localFont({
  src: [
    { path: "./fonts/BagossStandard-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/BagossStandard-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-bagoss",
  display: "swap",
});

// Fragment Mono: the live site's secondary mono (SIL OFL), self-hosted from @fontsource.
// Stands in for General Grotesque Mono, which is not in the studio's font folder.
const fragmentMono = localFont({
  src: [
    { path: "./fonts/fragment-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/fragment-mono-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-fragment-mono",
  display: "swap",
});

// Theme type pairings for consultation sites (lib/themes.ts). Not preloaded:
// a face only downloads when a page uses a theme that needs it.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", preload: false });
const themeFonts = [fraunces, dmSans, spaceGrotesk, manrope, newsreader].map((font) => font.variable).join(" ");

export const metadata: Metadata = {
  title: `${PRODUCT.name} – by ${PRODUCT.maker}`,
  description:
    "White-label platform for planning and regeneration consultation sites: modular pages, an interactive masterplan map, surveys and map comments, on your own brand and domain.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${bagoss.variable} ${fragmentMono.variable} ${themeFonts} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
