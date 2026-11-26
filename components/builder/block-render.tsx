"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Download,
  FileText,
  ImageIcon,
  Mail,
  MapPin,
  Menu,
  Phone,
  Play,
  Plus,
  X,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import {
  isShown,
  readAnimation,
  readItems,
  readStyle,
  visibleProps,
  readList,
  readMedia,
  readText,
  safeUrl,
  type AnimationName,
  type Media,
} from "@/lib/blocks";
import { EASE_OUT } from "@/lib/motion";
import type { Block } from "@/lib/sites";
import { LiveMap, glass, type Corners } from "@/components/map/live-map";
import { demoPins, pad, planBounds, type Bounds } from "@/lib/geo";
import { layerImage, planCorners, planId, readPlan } from "@/lib/svg-plan";
import { isBasemap } from "@/lib/map-styles";
import { cn } from "@/lib/utils";

/*
  What each block looks like on the page. One branch per block kind.

  These render in the editor canvas, the full-page preview and, later, the
  published site, so they take only the block's props, the accent colour and
  whether they are being edited.

  Layout follows the width of the page, not the browser window: the page
  wrapper is a CSS container, and blocks use container queries
    @lg  (32rem, ~512px)  = tablet and up
    @3xl (48rem, ~768px)  = desktop
  so the phone and tablet previews in the editor show the real phone and
  tablet layouts.
*/

type Props = Block["props"];
type BlockProps = { props: Props; accent: string; editing: boolean };

const VARIANTS: Record<AnimationName, { initial: Record<string, number>; duration: number }> = {
  none: { initial: {}, duration: 0 },
  fade: { initial: { opacity: 0 }, duration: 0.5 },
  rise: { initial: { opacity: 0, y: 24 }, duration: 0.6 },
  slide: { initial: { opacity: 0, x: -32 }, duration: 0.6 },
  scale: { initial: { opacity: 0, scale: 0.96 }, duration: 0.5 },
};

/** Wraps a block in its chosen entrance animation, played as it scrolls into view. */
function Animated({ block, children }: { block: Block; children: React.ReactNode }) {
  const reduce = useReducedMotion() ?? false;
  const name = readAnimation(block.props);
  const variant = VARIANTS[name];

  if (reduce || name === "none") return <>{children}</>;

  return (
    <motion.div
      /* Re-keyed on the animation name so changing it in the inspector replays it. */
      key={name}
      initial={variant.initial}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: variant.duration, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Shared pieces ---------- */

/* Vertical padding comes from the block's spacing setting (--block-py, see globals.css). */
const section = "px-5 py-(--block-py) @lg:px-8 @3xl:px-12";
const inner = "mx-auto w-full max-w-[68rem]";
const h2 = "text-balance text-[1.35rem] font-medium leading-tight tracking-[-0.015em] text-ink @3xl:text-[1.75rem]";
const lead = "max-w-[60ch] text-pretty text-[0.95rem] leading-[1.6] text-ink/75";

function Heading({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <h2 className={h2}>{children}</h2>;
}

/** An uploaded image, or a quiet placeholder until one is added. */
function Picture({
  media,
  className,
  fit = "cover",
  editing,
}: {
  media: Media;
  className?: string;
  fit?: "cover" | "contain";
  editing: boolean;
}) {
  const src = safeUrl(media.url);
  if (!src) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-ink/[0.04] text-ink/30",
          "bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(19,23,19,0.03)_10px_20px)]",
          className,
        )}
      >
        <span className="flex flex-col items-center gap-1.5">
          <ImageIcon className="size-5" strokeWidth={1.5} aria-hidden="true" />
          {editing && <span className="font-mono text-[0.55rem] uppercase tracking-[0.1em]">Add an image</span>}
        </span>
      </div>
    );
  }
  return (
    // Uploaded images live on the WordPress host, so a plain img is used rather than next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={media.alt}
      loading="lazy"
      decoding="async"
      className={cn(fit === "cover" ? "object-cover" : "object-contain", className)}
    />
  );
}

/** A button or link that does nothing while editing, so clicks select the block instead. */
function Action({
  href,
  editing,
  className,
  style,
  children,
}: {
  href?: string;
  editing: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const url = href ? safeUrl(href) : "";
  if (editing || !url) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {children}
    </a>
  );
}

const button =
  "inline-flex h-11 items-center gap-2 rounded-sw px-5 text-[0.9rem] font-medium text-ink transition-[filter] duration-150 hover:brightness-95";

/* ---------- Page ---------- */

function Header({ props, accent, editing }: BlockProps) {
  const links = readList(props, "links");
  const logo = readMedia(props, "logo");
  const cta = readText(props, "cta");
  const [open, setOpen] = useState(false);

  return (
    <div className="relative border-b border-ink/10">
      <div className={cn(inner, "flex items-center justify-between gap-4 px-5 py-3.5 @lg:px-8 @3xl:px-12")}>
        <span className="flex min-w-0 items-center gap-2.5 text-[0.98rem] font-medium text-ink">
          {logo.url ? (
            <Picture media={logo} fit="contain" editing={editing} className="h-8 w-auto max-w-[9rem]" />
          ) : (
            <span aria-hidden="true" className="size-3.5 shrink-0 rounded-[3px]" style={{ backgroundColor: accent }} />
          )}
          <span className="truncate">{readText(props, "title")}</span>
        </span>

        <nav aria-label="Main" className="hidden items-center gap-6 @3xl:flex">
          <ul className="flex gap-5 text-[0.85rem] text-ink/65">
            {links.map((link, index) => (
              <li key={`${link}-${index}`} className={index === 0 ? "text-ink" : undefined}>
                {link}
              </li>
            ))}
          </ul>
          {cta && (
            <span className="inline-flex h-9 items-center rounded-sw px-3.5 text-[0.84rem] font-medium text-ink" style={{ backgroundColor: accent }}>
              {cta}
            </span>
          )}
        </nav>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={(event) => {
            if (editing) return;
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink hover:bg-ink/5 @3xl:hidden"
        >
          {open ? <X className="size-4.5" aria-hidden="true" /> : <Menu className="size-4.5" aria-hidden="true" />}
        </button>
      </div>

      {open && !editing && (
        <ul className="flex flex-col border-t border-ink/10 px-5 py-2 text-[0.95rem] text-ink @3xl:hidden">
          {links.map((link, index) => (
            <li key={`${link}-${index}`} className="border-b border-ink/5 py-3 last:border-0">
              {link}
            </li>
          ))}
          {cta && (
            <li className="py-3">
              <span className={cn(button, "w-full justify-center")} style={{ backgroundColor: accent }}>
                {cta}
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

const HERO_SHAPES: Record<string, string> = {
  landscape: "aspect-[4/3]",
  square: "aspect-square",
  portrait: "aspect-[4/5]",
};

const HERO_HEIGHTS: Record<string, string> = {
  short: "min-h-[20rem] @3xl:min-h-[24rem]",
  tall: "min-h-[28rem] @3xl:min-h-[34rem]",
  screen: "min-h-[100svh]",
};

function Hero({ props, accent, editing }: BlockProps) {
  const eyebrow = readText(props, "eyebrow");
  const title = readText(props, "title");
  const body = readText(props, "body");
  const cta = readText(props, "cta");
  const image = readMedia(props, "image");
  /* Hiding the image, or choosing "None", gives the text-only layout. */
  const layout = isShown(props, "image") ? readText(props, "layout", "split") : "plain";

  const copy = (light: boolean) => (
    <>
      {eyebrow && (
        <p className={cn("font-mono text-[0.64rem] uppercase tracking-[0.12em]", light ? "text-white/80" : "text-ink/55")}>{eyebrow}</p>
      )}
      {title && (
        <h1
          className={cn(
            "max-w-[18ch] text-balance text-[2rem] font-medium leading-[1.05] tracking-[-0.025em] @lg:text-[2.5rem] @3xl:text-[3.1rem]",
            eyebrow && "mt-3",
            light ? "text-white" : "text-ink",
          )}
        >
          {title}
        </h1>
      )}
      {body && (
        <p
          className={cn(
            "max-w-[46ch] text-pretty text-[0.98rem] leading-[1.55] @3xl:text-[1.05rem]",
            (eyebrow || title) && "mt-4",
            light ? "text-white/90" : "text-ink/75",
          )}
        >
          {body}
        </p>
      )}
      {cta && (
        <span className={cn(button, (eyebrow || title || body) && "mt-6")} style={{ backgroundColor: accent }}>
          {cta}
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      )}
    </>
  );

  if (layout === "cover") {
    const hasImage = Boolean(safeUrl(image.url));
    const light = hasImage && readText(props, "overlay", "dark") !== "light";
    return (
      <div className={cn("relative isolate flex items-end overflow-hidden", HERO_HEIGHTS[readText(props, "height", "tall")] ?? HERO_HEIGHTS.tall)}>
        <Picture media={image} editing={editing} className="absolute inset-0 -z-10 size-full" />
        {hasImage && (
          <div
            aria-hidden="true"
            className={cn(
              "absolute inset-0 -z-10",
              light ? "bg-gradient-to-t from-ink/80 via-ink/35 to-ink/0" : "bg-gradient-to-t from-white/90 via-white/55 to-white/0",
            )}
          />
        )}
        <div className={cn(inner, "px-5 pb-(--block-py) pt-24 @lg:px-8 @3xl:px-12")}>{copy(light)}</div>
      </div>
    );
  }

  if (layout === "plain") {
    return (
      <div className={section}>
        <div className={inner}>{copy(false)}</div>
      </div>
    );
  }

  const left = layout === "split-left";
  return (
    <div className={section}>
      <div className={cn(inner, "grid items-center gap-8 @3xl:gap-12", left ? "@3xl:grid-cols-[1fr_1.05fr]" : "@3xl:grid-cols-[1.05fr_1fr]")}>
        <div className={cn(left && "@3xl:order-last")}>{copy(false)}</div>
        <Picture
          media={image}
          editing={editing}
          className={cn("w-full rounded-xl", HERO_SHAPES[readText(props, "shape", "landscape")] ?? HERO_SHAPES.landscape)}
        />
      </div>
    </div>
  );
}

function TextBlock({ props }: BlockProps) {
  const paragraphs = readText(props, "body")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        <div className="mt-3 flex flex-col gap-3">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className={cn(lead, "whitespace-pre-line")}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer({ props }: BlockProps) {
  return (
    <div className="border-t border-ink/10 px-5 py-6 @lg:px-8 @3xl:px-12">
      <div className={cn(inner, "flex flex-col gap-1.5 text-[0.84rem] text-ink/70 @lg:flex-row @lg:items-center @lg:justify-between")}>
        <span className="break-words">{readText(props, "contact")}</span>
        <span>{readText(props, "note")}</span>
      </div>
    </div>
  );
}

/* ---------- Showcase ---------- */

function Gallery({ props, editing }: BlockProps) {
  const images = readItems(props, "images");
  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        {/* Phone: a swipeable row. Tablet and up: a grid. */}
        <ul className="-mx-5 mt-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @lg:mx-0 @lg:grid @lg:grid-cols-2 @lg:overflow-visible @lg:px-0 @3xl:grid-cols-3">
          {images.map((item, index) => (
            <li key={index} className="w-[82%] shrink-0 snap-start @lg:w-auto">
              <figure>
                <Picture media={readMedia(item, "image")} editing={editing} className="aspect-[4/3] w-full rounded-lg" />
                {readText(item, "caption") && (
                  <figcaption className="mt-2 text-[0.82rem] leading-snug text-ink/65">{readText(item, "caption")}</figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Compare({ props, accent, editing }: BlockProps) {
  const [position, setPosition] = useState(50);
  const before = readMedia(props, "before");
  const after = readMedia(props, "after");
  const beforeLabel = readText(props, "beforeLabel");
  const afterLabel = readText(props, "afterLabel");

  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        <div className="relative mt-5 aspect-[4/3] select-none overflow-hidden rounded-xl @3xl:aspect-[16/9]">
          <Picture media={after} editing={editing} className="absolute inset-0 size-full" />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
            <Picture media={before} editing={editing} className="absolute inset-0 size-full bg-paper" />
          </div>

          {beforeLabel && <span className={cn(glass, "absolute left-3 top-3 px-2.5 py-1 text-[0.74rem] font-medium text-ink")}>{beforeLabel}</span>}
          {afterLabel && <span className={cn(glass, "absolute right-3 top-3 px-2.5 py-1 text-[0.74rem] font-medium text-ink")}>{afterLabel}</span>}

          {/* The handle */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(19,23,19,0.15)]" style={{ left: `${position}%` }}>
            <span
              className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-ink shadow-lg"
              style={{ backgroundColor: accent }}
            >
              <span className="flex gap-0.5 text-[0.7rem] font-semibold">
                <span>&lsaquo;</span>
                <span>&rsaquo;</span>
              </span>
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Compare ${(beforeLabel || "before").toLowerCase()} and ${(afterLabel || "after").toLowerCase()}`}
            className="absolute inset-0 size-full cursor-ew-resize opacity-0"
          />
        </div>
        {readText(props, "caption") && <p className="mt-2.5 text-[0.82rem] text-ink/60">{readText(props, "caption")}</p>}
      </div>
    </div>
  );
}

/** Turns a YouTube or Vimeo page link into its privacy-friendly embed, or recognises a video file. */
function videoSource(raw: string): { kind: "embed" | "file"; src: string } | null {
  const url = safeUrl(raw.trim());
  if (!url) return null;
  const parsed = new URL(url, "https://example.invalid");
  const host = parsed.hostname.replace(/^www\./, "");

  let id: string | null = null;
  if (host === "youtu.be") id = parsed.pathname.slice(1);
  else if (host.endsWith("youtube.com")) {
    id = parsed.searchParams.get("v") ?? parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const vimeo = parsed.pathname.match(/(\d{6,12})/)?.[1];
    if (vimeo) return { kind: "embed", src: `https://player.vimeo.com/video/${vimeo}?dnt=1` };
  }

  if (/\.(mp4|webm|mov)$/i.test(parsed.pathname)) return { kind: "file", src: url };
  return null;
}

function Video({ props, editing }: BlockProps) {
  const source = videoSource(readText(props, "url"));
  const title = readText(props, "title", "Video");
  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        <div className="relative mt-5 aspect-video overflow-hidden rounded-xl bg-ink">
          {source?.kind === "embed" && (
            <iframe
              src={source.src}
              title={title}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className={cn("absolute inset-0 size-full", editing && "pointer-events-none")}
            />
          )}
          {source?.kind === "file" && (
            <video src={source.src} controls preload="metadata" className={cn("absolute inset-0 size-full", editing && "pointer-events-none")} />
          )}
          {!source && (
            <div className="absolute inset-0 grid place-items-center text-white/60">
              <span className="flex flex-col items-center gap-2">
                <span className="grid size-14 place-items-center rounded-full bg-white/10">
                  <Play className="size-6" aria-hidden="true" />
                </span>
                {editing && <span className="font-mono text-[0.58rem] uppercase tracking-[0.1em]">Paste a video link</span>}
              </span>
            </div>
          )}
        </div>
        {readText(props, "caption") && <p className="mt-2.5 text-[0.82rem] text-ink/60">{readText(props, "caption")}</p>}
      </div>
    </div>
  );
}

function Facts({ props, accent }: BlockProps) {
  const facts = readItems(props, "facts");
  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        <dl
          className={cn(
            "mt-6 grid grid-cols-2 gap-x-4 gap-y-6",
            facts.length % 3 === 0 ? "@3xl:grid-cols-3" : "@3xl:grid-cols-4",
          )}
        >
          {facts.map((fact, index) => (
            <div key={index} className="flex flex-col-reverse gap-1 border-t-2 pt-3" style={{ borderColor: accent }}>
              <dt className="text-[0.84rem] leading-snug text-ink/65">{readText(fact, "label")}</dt>
              <dd className="text-[1.9rem] font-medium leading-none tracking-[-0.03em] text-ink tabular-nums @3xl:text-[2.6rem]">
                {readText(fact, "value")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Proposals({ props, editing }: BlockProps) {
  const cards = readItems(props, "cards");
  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        {readText(props, "intro") && <p className={cn(lead, "mt-2.5")}>{readText(props, "intro")}</p>}
        <ul className="mt-6 grid gap-4 @lg:grid-cols-2 @3xl:grid-cols-3">
          {cards.map((card, index) => (
            <li key={index} className="flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-white">
              <Picture media={readMedia(card, "image")} editing={editing} className="aspect-[16/10] w-full" />
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-[1.02rem] font-medium leading-snug text-ink">{readText(card, "title")}</h3>
                <p className="mt-1.5 text-[0.87rem] leading-[1.5] text-ink/70">{readText(card, "body")}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Features({ props }: BlockProps) {
  const features = readItems(props, "features");
  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        <ol className="mt-6 grid gap-x-6 gap-y-5 @lg:grid-cols-2 @3xl:grid-cols-3">
          {features.map((feature, index) => (
            <li key={index} className="flex gap-3.5">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full font-mono text-[0.72rem] text-ink"
                style={{ backgroundColor: ACCENT_2 }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-[0.98rem] font-medium leading-snug text-ink">{readText(feature, "title")}</h3>
                <p className="mt-1 text-[0.86rem] leading-[1.5] text-ink/70">{readText(feature, "body")}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Team({ props, editing }: BlockProps) {
  const people = readItems(props, "people");
  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        <ul className="mt-6 grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4">
          {people.map((person, index) => (
            <li key={index} className="flex flex-col items-start gap-3 rounded-xl border border-ink/10 bg-white p-4">
              <Picture media={readMedia(person, "logo")} fit="contain" editing={editing} className="h-12 w-full max-w-[8rem] rounded-md" />
              <div className="min-w-0">
                <p className="text-[0.92rem] font-medium leading-snug text-ink">{readText(person, "name")}</p>
                <p className="mt-0.5 text-[0.8rem] text-ink/60">{readText(person, "role")}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function QuoteBlock({ props, accent, editing }: BlockProps) {
  const photo = readMedia(props, "photo");
  return (
    <div className={section}>
      <figure className={cn(inner, "max-w-[52rem]")}>
        <span aria-hidden="true" className="block h-1 w-12 rounded-full" style={{ backgroundColor: accent }} />
        {readText(props, "quote") && <blockquote className="mt-5 text-balance text-[1.3rem] font-medium leading-[1.3] tracking-[-0.015em] text-ink @3xl:text-[1.85rem]">
          &ldquo;{readText(props, "quote")}&rdquo;
        </blockquote>}
        <figcaption className="mt-5 flex items-center gap-3">
          {photo.url && <Picture media={photo} editing={editing} className="size-11 rounded-full" />}
          <span>
            <span className="block text-[0.9rem] font-medium text-ink">{readText(props, "name")}</span>
            <span className="block text-[0.8rem] text-ink/60">{readText(props, "role")}</span>
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

/* ---------- Information ---------- */

const DAY = 86_400_000;
const subscribeDay = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};
/** Today as a day number, read on the client only so server and client markup agree. */
function useToday(): number | null {
  return useSyncExternalStore(subscribeDay, () => Math.floor(Date.now() / DAY), () => null);
}

function KeyDate({ props }: BlockProps) {
  const today = useToday();
  const raw = readText(props, "date");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const target = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  const days = target !== null && today !== null ? Math.round(target / DAY - today) : null;
  const formatted =
    target !== null
      ? new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(target)
      : "Set a date";

  return (
    <div className={section}>
      <div
        className={cn(inner, "flex flex-col gap-5 rounded-2xl p-6 @lg:flex-row @lg:items-center @lg:justify-between @3xl:p-8")}
        style={{ backgroundColor: ACCENT_2 }}
      >
        <div>
          {readText(props, "label") && <p className="mb-2 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-ink/65">{readText(props, "label")}</p>}
          <p className="text-[1.45rem] font-medium leading-tight tracking-[-0.02em] text-ink @3xl:text-[1.9rem]">{formatted}</p>
          {readText(props, "body") && <p className="mt-1.5 text-[0.9rem] text-ink/75">{readText(props, "body")}</p>}
        </div>
        {days !== null && (
          <div className="flex shrink-0 items-baseline gap-2 rounded-xl bg-[rgb(255_255_255/0.6)] px-4 py-3 @lg:flex-col @lg:items-center @lg:gap-0 @lg:px-6">
            <span className="text-[2.2rem] font-medium leading-none tracking-[-0.03em] text-ink tabular-nums">{Math.max(days, 0)}</span>
            <span className="text-[0.8rem] text-ink/70">{days > 1 ? "days to go" : days === 1 ? "day to go" : days === 0 ? "closes today" : "now closed"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Timeline({ props, accent }: BlockProps) {
  const stages = readList(props, "stages");
  const current = Math.max(0, (Number(readText(props, "current", "1")) || 1) - 1);
  const tone = (index: number) => (index <= current ? accent : "rgba(19,23,19,0.12)");

  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        {/* Vertical on phones, a row of steps from tablet up */}
        <ol className="mt-6 flex flex-col @3xl:flex-row">
          {stages.map((stage, index) => (
            <li key={`${stage}-${index}`} className="flex gap-3 @3xl:flex-1 @3xl:flex-col @3xl:gap-3">
              <div className="flex flex-col items-center @3xl:flex-row">
                <span
                  aria-hidden="true"
                  className={cn("grid size-6 shrink-0 place-items-center rounded-full font-mono text-[0.6rem] text-ink", index === current && "ring-4 ring-ink/10")}
                  style={{ backgroundColor: tone(index) }}
                >
                  {index + 1}
                </span>
                {index < stages.length - 1 && (
                  <span className="min-h-6 w-0.5 flex-1 @3xl:h-0.5 @3xl:min-h-0 @3xl:w-auto" style={{ backgroundColor: tone(index + 1) }} />
                )}
              </div>
              <span className={cn("pb-5 pt-0.5 text-[0.9rem] leading-snug @3xl:pb-0 @3xl:pr-4", index === current ? "font-medium text-ink" : "text-ink/70")}>
                {stage}
                {index === current && <span className="ml-1.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ink/50">Now</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Faq({ props }: BlockProps) {
  const questions = readItems(props, "questions");
  return (
    <div className={section}>
      <div className={cn(inner, "max-w-[52rem]")}>
        <Heading>{readText(props, "title")}</Heading>
        <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
          {questions.map((item, index) => (
            <details key={index} className="group/faq">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[0.95rem] font-medium text-ink [&::-webkit-details-marker]:hidden">
                {readText(item, "question")}
                <Plus className="size-4 shrink-0 text-ink/50 transition-transform duration-200 group-open/faq:rotate-45" aria-hidden="true" />
              </summary>
              <p className="pb-4 pr-8 text-[0.88rem] leading-[1.6] text-ink/70">{readText(item, "answer")}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

function fileSize(bytes?: number): string {
  if (!bytes) return "";
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function Documents({ props, editing }: BlockProps) {
  const files = readItems(props, "files");
  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        <ul className="mt-5 grid gap-2.5 @3xl:grid-cols-2">
          {files.map((item, index) => {
            const file = readMedia(item, "file");
            const meta = [file.url ? "PDF" : "No file yet", fileSize(file.size)].filter(Boolean).join(" · ");
            return (
              <li key={index}>
                <Action
                  href={file.url}
                  editing={editing}
                  className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white p-3.5 transition-colors hover:bg-paper"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-paper text-ink/70">
                    <FileText className="size-4.5" strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9rem] font-medium text-ink">{readText(item, "title")}</span>
                    <span className="block text-[0.76rem] text-ink/55">{meta}</span>
                  </span>
                  <Download className="size-4 shrink-0 text-ink/50" aria-hidden="true" />
                </Action>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Contact({ props, accent }: BlockProps) {
  const rows = [
    { icon: Mail, label: "Email", value: readText(props, "email") },
    { icon: Phone, label: "Phone", value: readText(props, "phone") },
    { icon: MapPin, label: "Post", value: readText(props, "address") },
    { icon: Clock, label: "Hours", value: readText(props, "hours") },
  ].filter((row) => row.value);

  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        <dl className="mt-5 grid gap-3 @lg:grid-cols-2">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex gap-3 rounded-xl border border-ink/10 bg-white p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full text-ink" style={{ backgroundColor: accent }}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <dt className="font-mono text-[0.58rem] uppercase tracking-[0.1em] text-ink/50">{label}</dt>
                <dd className="mt-0.5 whitespace-pre-line break-words text-[0.9rem] leading-snug text-ink">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* ---------- Engagement ---------- */

/* Default spot for a new map block until the client sets the scheme location. */
const DEMO_CENTRE: [number, number] = [53.4084, -2.1494];

/* A real street map with comment pins. Still in the editor so dragging the page never pans it.
   With a layered masterplan, the drawing sits on the map at its OS grid references and each
   layer gets a switch. Without grid references it is shown at the scheme's centre. */
function MapBlock({ props, accent, editing }: BlockProps) {
  const plan = readPlan(props.plan);
  const corners: Corners | null = plan ? planCorners(plan) : null;
  const footprint: Bounds | null = corners
    ? {
        west: Math.min(...corners.map((c) => c[0])),
        east: Math.max(...corners.map((c) => c[0])),
        south: Math.min(...corners.map((c) => c[1])),
        north: Math.max(...corners.map((c) => c[1])),
      }
    : plan
      ? planBounds(DEMO_CENTRE, plan.width, plan.height, 400)
      : null;
  const centre: [number, number] = footprint
    ? [(footprint.north + footprint.south) / 2, (footprint.east + footprint.west) / 2]
    : DEMO_CENTRE;

  /* Visitors' own layer choices, on top of the defaults set in the editor. */
  const [switched, setSwitched] = useState<Record<string, boolean>>({});
  const [layersOpen, setLayersOpen] = useState<boolean | null>(null);
  const id = plan ? planId(plan) : "";
  const isOn = (key: string, fallback: boolean) => (editing ? fallback : (switched[`${id}:${key}`] ?? fallback));

  const pinCount = Number(readText(props, "pins", "4")) || 0;
  const pins = demoPins(centre, pinCount);
  const reach = readText(props, "reach", "site") === "wide" ? "wide" : "site";

  const overlay =
    plan && footprint
      ? {
          images: plan.layers.map((layer) => ({
            key: `${id}-${layer.key}`,
            url: layerImage(plan, layer.key),
            visible: isOn(layer.key, layer.on),
          })),
          bounds: footprint,
          aspect: plan.height / plan.width,
          corners: corners ?? undefined,
        }
      : undefined;

  return (
    <div className={section}>
      <div className={inner}>
        <Heading>{readText(props, "title")}</Heading>
        <LiveMap
          /* A new plan or a new position starts a fresh map, framed on the plan. */
          key={`${id}|${corners ? `${corners[0].join()}|${corners[2].join()}` : "unplaced"}`}
          still={editing}
          centre={centre}
          zoom={16.2}
          pins={pins}
          overlay={overlay}
          overlayOpacity={0.92}
          fit={footprint ? pad(footprint, 0.08) : undefined}
          reach={reach}
          basemap={isBasemap(props.basemap) ? props.basemap : "streets"}
          threeD={readText(props, "view") === "3d"}
          className={cn("h-[22rem] rounded-xl border border-ink/10 @3xl:h-[30rem]", readText(props, "title") && "mt-5")}
        >
          {readText(props, "caption") && (
            <div className={cn(glass, "absolute left-3 right-3 top-3 z-10 flex items-center gap-2 px-3 py-2.5 @lg:right-auto @lg:max-w-[60%]")}>
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full" style={{ backgroundColor: accent }}>
                <MapPin className="size-3.5 text-ink" />
              </span>
              <span className="text-[0.8rem] leading-snug text-ink">{readText(props, "caption")}</span>
            </div>
          )}

          {plan && plan.layers.length > 1 && (
            <div className={cn(glass, "absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] @lg:max-w-[16rem]")}>
              <button
                type="button"
                aria-expanded={layersOpen ?? undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  /* Until someone chooses, the list is open on wide pages and closed on narrow ones (CSS). */
                  const list = event.currentTarget.nextElementSibling;
                  const shown = list ? getComputedStyle(list).display !== "none" : true;
                  setLayersOpen(!shown);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-[0.72rem] font-medium uppercase tracking-[0.08em] text-ink/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
              >
                Plan layers
                <span aria-hidden="true" className={cn("transition-transform duration-200", layersOpen === null ? "@max-lg:-rotate-90" : !layersOpen && "-rotate-90")}>
                  ▾
                </span>
              </button>
              <ul className={cn("max-h-[11rem] flex-col gap-0.5 overflow-y-auto px-1.5 pb-1.5", layersOpen === null ? "hidden @lg:flex" : layersOpen ? "flex" : "hidden")}>
                {plan.layers.map((layer) => {
                  const on = isOn(layer.key, layer.on);
                  return (
                    <li key={layer.key}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        tabIndex={editing ? -1 : 0}
                        onClick={(event) => {
                          if (editing) return;
                          event.stopPropagation();
                          setSwitched((all) => ({ ...all, [`${id}:${layer.key}`]: !on }));
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-[0.78rem] text-ink transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-ink"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200",
                            on ? "bg-ink" : "bg-ink/20",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 size-3 rounded-full bg-white shadow transition-[left] duration-200",
                              on ? "left-3.5" : "left-0.5",
                            )}
                          />
                        </span>
                        <span className="min-w-0 truncate">{layer.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </LiveMap>
      </div>
    </div>
  );
}

function Survey({ props, accent, editing }: BlockProps) {
  const answers = readList(props, "answers");
  const [choice, setChoice] = useState<number | null>(null);

  return (
    <div className={section}>
      <fieldset className={cn(inner, "max-w-[44rem] rounded-2xl border border-ink/10 bg-white p-5 @3xl:p-7")}>
        <legend className="sr-only">{readText(props, "question")}</legend>
        <p aria-hidden="true" className="text-[1.05rem] font-medium leading-snug text-ink @3xl:text-[1.2rem]">
          {readText(props, "question")}
        </p>
        <div className="mt-4 grid gap-2 @lg:grid-cols-2">
          {answers.map((answer, index) => {
            const picked = choice === index;
            return (
              <label
                key={`${answer}-${index}`}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[0.9rem] text-ink transition-colors",
                  picked ? "border-ink" : "border-ink/12 hover:border-ink/30",
                )}
              >
                <input
                  type="radio"
                  name={`survey-${readText(props, "question")}`}
                  checked={picked}
                  disabled={editing}
                  onChange={() => setChoice(index)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="grid size-4 shrink-0 place-items-center rounded-full border-2"
                  style={{ borderColor: picked ? "#131713" : "rgba(19,23,19,0.25)" }}
                >
                  {picked && <span className="size-2 rounded-full bg-ink" />}
                </span>
                {answer}
              </label>
            );
          })}
        </div>
        <span className={cn(button, "mt-5", !editing && choice === null && "opacity-50")} style={{ backgroundColor: accent }}>
          Submit answer
        </span>
      </fieldset>
    </div>
  );
}

/* ---------- Dispatcher ---------- */

const RENDERERS: Record<Block["kind"], (props: BlockProps) => React.ReactNode> = {
  header: Header,
  hero: Hero,
  text: TextBlock,
  footer: Footer,
  gallery: Gallery,
  compare: Compare,
  video: Video,
  facts: Facts,
  proposals: Proposals,
  features: Features,
  team: Team,
  quote: QuoteBlock,
  keydate: KeyDate,
  timeline: Timeline,
  faq: Faq,
  documents: Documents,
  contact: Contact,
  map: MapBlock,
  survey: Survey,
};

/* Colours come from the page theme (lib/themes.ts) as CSS variables, so the
   same block looks right in every theme and follows brand-colour changes. */
const ACCENT = "var(--t-accent)";
const ACCENT_2 = "var(--t-accent-2)";

const BACKGROUNDS = {
  none: undefined,
  paper: "var(--sw-paper)",
  tint: `color-mix(in srgb, ${ACCENT} 22%, var(--color-white))`,
} as const;

/**
 * One block on the page, with its style settings applied around it.
 * Hidden devices are taken out on the live page; in the editor the block is
 * faded instead, so it can still be selected and switched back on.
 */
export function BlockRender({ block, editing = false }: { block: Block; editing?: boolean }) {
  const Render = RENDERERS[block.kind];
  if (!Render) return null;
  const style = readStyle(block.props);
  const hidden = style.hideOn.length ? style.hideOn.join(" ") : undefined;

  return (
    <div
      className="op-block"
      data-spacing={style.spacing}
      data-align={style.align}
      data-hide={editing ? undefined : hidden}
      data-faded={editing ? hidden : undefined}
      style={{ backgroundColor: BACKGROUNDS[style.background] }}
    >
      <Animated block={block}>
        <Render props={visibleProps(block.props)} accent={ACCENT} editing={editing} />
      </Animated>
    </div>
  );
}
