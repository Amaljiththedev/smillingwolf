/*
  Layered SVG masterplans.

  Architects supply the plan as one SVG with a layer per element of the
  scheme (site boundary, buildings, landscape, routes...). Each top-level
  group in the file becomes a layer that visitors can switch on and off.
  Layer names come from Illustrator (data-name / id) or Inkscape
  (inkscape:label).

  Two kinds of file:
  - Light vector drawings (under 1.5 MB, no embedded pictures) are kept as
    SVG text with the page.
  - Heavy files, typically Photoshop renders exported through Illustrator
    (one embedded PNG per layer, often 100 MB or more), are "flattened" in
    the browser: each layer is drawn once to a WebP image the size of a
    large screen. Those images are uploaded to the media library, or kept
    with the page when there is no WordPress connection and they are small
    enough.

  Placing the drawing on the map, either:
  - "points": two points clicked on the drawing with their OS grid
    references. Handles any scale and any rotation, and matches how
    architects set out schemes (setting-out points on the drawings).
  - "corners": grid references of the drawing's bottom-left and top-right
    corners, for north-up drawings whose sheet edges sit on known grid lines.

  Files are cleaned on the way in: scripts, embedded pages, event handlers
  and links to other sites are removed. The plan is only ever drawn as an
  image, where none of those would run anyway, but nothing unsafe is kept.

  Browser only (uses DOMParser, XMLSerializer and canvas).
*/

import { drawingCorners, gridToLatLng, parseGridRef, type GridRef } from "@/lib/osgrid";

export type PlanLayer = { key: string; label: string; on: boolean };

/** A point on the drawing (in the SVG's own units, y down) and its OS grid reference as typed. */
export type ControlPoint = { x: number; y: number; ref: string };

export type SvgPlan = {
  name: string;
  /** Light plans: the cleaned SVG, every layer group tagged with data-op-layer. Empty for flattened plans. */
  svg: string;
  /** Flattened plans: one image URL per layer key. */
  images?: Record<string, string>;
  width: number;
  height: number;
  layers: PlanLayer[];
  placement: "points" | "corners";
  points: [ControlPoint | null, ControlPoint | null];
  /** OS grid references of the drawing's bottom-left and top-right corners, as typed. */
  sw: string;
  ne: string;
};

/** Light plans kept as SVG text. Anything bigger is flattened to images. */
export const MAX_SVG_BYTES = 1_500_000;
/** The biggest file the browser is asked to open and flatten. */
export const MAX_FLATTEN_BYTES = 400_000_000;

const SVG_NS = "http://www.w3.org/2000/svg";
const BLOCKED = ["script", "foreignObject", "iframe", "object", "embed", "audio", "video", "handler", "listener"];
/* Shared by every layer: definitions, styles and descriptions. */
const SHARED = new Set(["defs", "style", "title", "desc", "metadata", "sodipodi:namedview"]);

function clean(root: Element) {
  for (const tag of BLOCKED) root.querySelectorAll(tag).forEach((node) => node.remove());
  const all = [root, ...root.querySelectorAll("*")];
  for (const node of all) {
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        node.removeAttribute(attr.name);
        continue;
      }
      /* Only look at the start of long values (embedded pictures run to many megabytes). */
      const head = attr.value.slice(0, 64).trim().toLowerCase();
      if (name === "href" || name.endsWith(":href")) {
        if (!head.startsWith("#") && !/^data:image\/(png|jpe?g|gif|webp);/.test(head)) node.removeAttribute(attr.name);
      } else if (attr.value.length < 4096 && /url\(\s*['"]?\s*(?!#)/i.test(attr.value) && name !== "d") {
        node.setAttribute(attr.name, attr.value.replace(/url\(\s*['"]?\s*(?!#)[^)]*\)/gi, "none"));
      }
    }
  }
  root.querySelectorAll("style").forEach((style) => {
    style.textContent = (style.textContent ?? "")
      .replace(/@import[^;]*;?/gi, "")
      .replace(/url\(\s*['"]?\s*(?!#|data:image\/)[^)]*\)/gi, "none");
  });
}

function layerName(group: Element, index: number): string {
  const raw =
    group.getAttribute("inkscape:label") ||
    group.getAttribute("data-name") ||
    group.getAttribute("aria-label") ||
    group.getAttribute("id") ||
    "";
  const name = raw
    .replace(/_x([0-9a-f]{2})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    /* Odd characters from Photoshop exports, underscores and dashes become spaces. */
    .replace(/[^\p{L}\p{N}&()'.,+ ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    /* Photoshop layers come through as "Trees Image": the suffix says nothing. */
    .replace(/\s+image$/i, "");
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : `Layer ${index + 1}`;
}

function size(svg: Element): { width: number; height: number } | null {
  const box = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (box.length === 4 && box[2] > 0 && box[3] > 0) return { width: box[2], height: box[3] };
  const w = parseFloat(svg.getAttribute("width") ?? "");
  const h = parseFloat(svg.getAttribute("height") ?? "");
  return w > 0 && h > 0 ? { width: w, height: h } : null;
}

/** Opens, cleans and splits a file into layer groups. Shared by both kinds of plan. */
function open(text: string) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (doc.querySelector("parsererror") || svg.localName !== "svg") {
    throw new Error("That file is not a valid SVG.");
  }
  const dims = size(svg);
  if (!dims) throw new Error("The SVG has no size. Export it with a viewBox, or with width and height.");

  clean(svg);

  /* Layers are the top-level groups. If everything sits in one wrapper group, use its groups instead. */
  let parent: Element = svg;
  const topGroups = () => [...parent.children].filter((node) => node.localName === "g");
  const wrapper = topGroups();
  if (wrapper.length === 1 && [...wrapper[0].children].filter((node) => node.localName === "g").length > 1) {
    parent = wrapper[0];
  }

  /* Loose shapes outside any group become one "Base drawing" layer, so nothing is lost. */
  const loose = [...parent.children].filter((node) => node.localName !== "g" && !SHARED.has(node.nodeName));
  if (loose.length) {
    const base = doc.createElementNS(SVG_NS, "g");
    base.setAttribute("data-name", "Base drawing");
    parent.insertBefore(base, loose[0]);
    loose.forEach((node) => base.appendChild(node));
  }

  const groups = topGroups();
  if (!groups.length) throw new Error("The SVG has nothing to draw.");
  const layers = groups.map((group, index) => {
    const key = `L${index}`;
    group.setAttribute("data-op-layer", key);
    /* Layers hidden in the design file still exist; visitors can turn them on. */
    const hiddenInFile = group.getAttribute("display") === "none" || /display\s*:\s*none/.test(group.getAttribute("style") ?? "");
    group.removeAttribute("display");
    const style = (group.getAttribute("style") ?? "").replace(/display\s*:\s*none;?/g, "").trim();
    if (style) group.setAttribute("style", style);
    else group.removeAttribute("style");
    const label = layerName(group, index);
    return { key, label, on: !hiddenInFile && !BACKDROP.test(label) };
  });

  /* Pixel size from the viewBox, so the drawing keeps its shape when drawn as an image. */
  svg.setAttribute("width", String(dims.width));
  svg.setAttribute("height", String(dims.height));
  if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${dims.width} ${dims.height}`);

  return { svg, groups, layers, dims };
}

/*
  The architects' own backdrop (an aerial photo or a base map) starts switched
  off: the live map underneath already shows the ground. It stays a layer, so
  the editor or visitors can still turn it on.
*/
const BACKDROP = /\b(background|backdrop|aerial|satellite|ortho\w*|photo|base ?map|context)\b/i;

function blankPlan(name: string, width: number, height: number, layers: PlanLayer[]): Omit<SvgPlan, "svg"> {
  return { name, width, height, layers, placement: "points", points: [null, null], sw: "", ne: "" };
}

/** Does this file need flattening to images rather than keeping as SVG text? */
export function needsFlattening(text: string): boolean {
  return new Blob([text]).size > MAX_SVG_BYTES || /<image[\s>]/i.test(text);
}

/** Reads a light layered SVG file. Throws an Error with a message for the editor when it cannot be used. */
export function parseSvgPlan(text: string, name: string): SvgPlan {
  if (new Blob([text]).size > MAX_SVG_BYTES) {
    throw new Error("That SVG is over 1.5 MB.");
  }
  const { svg, layers, dims } = open(text);
  return { ...blankPlan(name, dims.width, dims.height, layers), svg: new XMLSerializer().serializeToString(svg) };
}

/** A flattened plan before its images are stored: one WebP per layer key. */
export type FlatPlan = { plan: Omit<SvgPlan, "svg" | "images">; blobs: Record<string, Blob> };

/**
 * Turns a heavy layered SVG into one image per layer, `maxEdge` pixels on the
 * long side. Runs in the browser; a 150 MB render takes some seconds.
 * 2560 px matches the size above which WordPress makes its own reduced copy.
 */
export async function flattenSvgPlan(
  text: string,
  name: string,
  { maxEdge = 2560, quality = 0.82, onProgress }: { maxEdge?: number; quality?: number; onProgress?: (done: number, total: number, label: string) => void } = {},
): Promise<FlatPlan> {
  const { svg, groups, layers, dims } = open(text);
  const scale = maxEdge / Math.max(dims.width, dims.height);
  const width = Math.round(dims.width * scale);
  const height = Math.round(dims.height * scale);
  const blobs: Record<string, Blob> = {};

  for (const [index, group] of groups.entries()) {
    const layer = layers[index];
    onProgress?.(index, groups.length, layer.label);
    /* Take every other layer out, serialise this one on its own, then put them back. */
    const placeholders = groups.map((other) => {
      if (other === group) return null;
      const mark = svg.ownerDocument.createComment("layer");
      other.replaceWith(mark);
      return mark;
    });
    const source = new XMLSerializer().serializeToString(svg);
    placeholders.forEach((mark, i) => mark?.replaceWith(groups[i]));

    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot draw the plan.");
      context.drawImage(img, 0, 0, width, height);
      blobs[layer.key] = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The plan could not be drawn."))), "image/webp", quality),
      );
    } catch (error) {
      throw new Error(`The layer "${layer.label}" could not be drawn. ${error instanceof Error ? error.message : ""}`.trim());
    } finally {
      URL.revokeObjectURL(url);
    }
    /* Let the page breathe between layers. */
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  onProgress?.(groups.length, groups.length, "");
  return { plan: blankPlan(name, dims.width, dims.height, layers), blobs };
}

/** Redraws a layer image smaller, for keeping it with the page when it cannot be uploaded. */
export async function shrinkImage(blob: Blob, maxEdge: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readPoint(value: unknown): ControlPoint | null {
  if (typeof value !== "object" || value === null) return null;
  const p = value as Partial<ControlPoint>;
  return typeof p.x === "number" && typeof p.y === "number" ? { x: p.x, y: p.y, ref: typeof p.ref === "string" ? p.ref : "" } : null;
}

/** Reads a plan saved in block props, or null. */
export function readPlan(value: unknown): SvgPlan | null {
  if (typeof value !== "object" || value === null) return null;
  const plan = value as Partial<SvgPlan>;
  const images =
    typeof plan.images === "object" && plan.images !== null
      ? Object.fromEntries(Object.entries(plan.images).filter(([, url]) => typeof url === "string"))
      : undefined;
  const hasSvg = typeof plan.svg === "string" && plan.svg !== "";
  if ((!hasSvg && !images) || !Array.isArray(plan.layers)) return null;
  const points = Array.isArray(plan.points) ? plan.points : [];
  const sw = typeof plan.sw === "string" ? plan.sw : "";
  const ne = typeof plan.ne === "string" ? plan.ne : "";
  return {
    name: typeof plan.name === "string" ? plan.name : "plan.svg",
    svg: hasSvg ? (plan.svg as string) : "",
    images,
    width: Number(plan.width) || 1,
    height: Number(plan.height) || 1,
    layers: plan.layers
      .filter((l): l is PlanLayer => typeof l?.key === "string")
      .map((l) => ({ key: l.key, label: typeof l.label === "string" ? l.label : l.key, on: l.on !== false })),
    /* Plans saved before two-point placement existed used corners. */
    placement: plan.placement === "points" || plan.placement === "corners" ? plan.placement : sw || ne ? "corners" : "points",
    points: [readPoint(points[0]), readPoint(points[1])],
    sw,
    ne,
  };
}

export type Placement = {
  /** Image corners as [lng, lat]: top-left, top-right, bottom-right, bottom-left. */
  corners: [[number, number], [number, number], [number, number], [number, number]];
  /** Ground size of the whole drawing, in metres. */
  widthMetres: number;
  heightMetres: number;
  /** Clockwise turn of the drawing from grid north, in degrees. */
  rotation: number;
};

/**
 * Two drawing points and their grid references define a similarity
 * transform (scale, rotation, shift). Worked in complex numbers:
 * z = x - iy on the drawing (y flipped so up is north), w = E + iN on the grid,
 * w = a z + b.
 */
function fromPoints(plan: SvgPlan, p1: ControlPoint, g1: GridRef, p2: ControlPoint, g2: GridRef): Placement | null {
  const zx = p2.x - p1.x;
  const zy = -(p2.y - p1.y);
  const wx = g2.easting - g1.easting;
  const wy = g2.northing - g1.northing;
  const denom = zx * zx + zy * zy;
  if (denom < 1e-9 || wx * wx + wy * wy < 1e-6) return null;
  /* a = w / z */
  const ar = (wx * zx + wy * zy) / denom;
  const ai = (wy * zx - wx * zy) / denom;
  const toGrid = (x: number, y: number): GridRef => {
    const dx = x - p1.x;
    const dy = -(y - p1.y);
    return { easting: g1.easting + ar * dx - ai * dy, northing: g1.northing + ai * dx + ar * dy };
  };
  const at = (x: number, y: number): [number, number] => {
    const [lat, lng] = gridToLatLng(toGrid(x, y));
    return [lng, lat];
  };
  const metresPerUnit = Math.hypot(ar, ai);
  return {
    corners: [at(0, 0), at(plan.width, 0), at(plan.width, plan.height), at(0, plan.height)],
    widthMetres: plan.width * metresPerUnit,
    heightMetres: plan.height * metresPerUnit,
    rotation: (-Math.atan2(ai, ar) * 180) / Math.PI,
  };
}

/** Where the plan sits on the map, if its placement is filled in and makes sense. */
export function planPlacement(plan: SvgPlan): Placement | null {
  if (plan.placement === "points") {
    const [p1, p2] = plan.points;
    const g1 = p1 && parseGridRef(p1.ref);
    const g2 = p2 && parseGridRef(p2.ref);
    return p1 && p2 && g1 && g2 ? fromPoints(plan, p1, g1, p2, g2) : null;
  }
  const sw = parseGridRef(plan.sw);
  const ne = parseGridRef(plan.ne);
  const corners = sw && ne ? drawingCorners(sw, ne) : null;
  return corners && sw && ne
    ? { corners, widthMetres: ne.easting - sw.easting, heightMetres: ne.northing - sw.northing, rotation: 0 }
    : null;
}

export function planCorners(plan: SvgPlan) {
  return planPlacement(plan)?.corners ?? null;
}

/* One image per layer for light plans: the whole file with every other layer removed. */
const layerCache = new Map<string, string>();

/** A short, stable id for a plan's content, so a replaced file gets fresh map images. */
export function planId(plan: SvgPlan): string {
  const content = plan.svg || Object.values(plan.images ?? {}).join("|");
  let hash = 5381;
  for (let i = 0; i < content.length; i += Math.max(1, Math.floor(content.length / 4000))) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  }
  return `${(hash >>> 0).toString(36)}${content.length.toString(36)}`;
}

export function layerImage(plan: SvgPlan, key: string): string {
  if (!plan.svg) {
    const url = plan.images?.[key] ?? "";
    /* Media-library images come through this app (see app/plan-image), so the map may draw them. */
    return /^https?:\/\//.test(url) ? `/plan-image?src=${encodeURIComponent(url)}` : url;
  }
  const cacheKey = `${planId(plan)}:${key}`;
  const cached = layerCache.get(cacheKey);
  if (cached) return cached;
  const doc = new DOMParser().parseFromString(plan.svg, "image/svg+xml");
  doc.querySelectorAll("[data-op-layer]").forEach((group) => {
    if (group.getAttribute("data-op-layer") !== key) group.remove();
  });
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(doc.documentElement))}`;
  layerCache.set(cacheKey, url);
  return url;
}
