/*
  Layered SVG masterplans.

  Architects supply the plan as one SVG with a layer per element of the
  scheme (site boundary, buildings, landscape, routes...). Each top-level
  group in the file becomes a layer that visitors can switch on and off.
  Layer names come from Illustrator (data-name / id) or Inkscape
  (inkscape:label).

  The drawing is placed on the map by the OS grid references of its
  bottom-left and top-right corners (see lib/osgrid.ts), so it is assumed to
  be drawn north-up, the way OS-based drawings are.

  Files are cleaned on the way in: scripts, embedded pages, event handlers
  and links to other sites are removed. The plan is only ever drawn as an
  image, where none of those would run anyway, but nothing unsafe is kept.

  Browser only (uses DOMParser and XMLSerializer).
*/

import { drawingCorners, parseGridRef } from "@/lib/osgrid";

export type PlanLayer = { key: string; label: string; on: boolean };

export type SvgPlan = {
  name: string;
  /** The cleaned SVG, every layer group tagged with data-op-layer. */
  svg: string;
  width: number;
  height: number;
  layers: PlanLayer[];
  /** OS grid references of the drawing's bottom-left and top-right corners, as typed. */
  sw: string;
  ne: string;
};

export const MAX_SVG_BYTES = 1_500_000;

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
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      else if ((name === "href" || name.endsWith(":href")) && !value.startsWith("#") && !/^data:image\/(png|jpe?g|gif|webp);/.test(value)) {
        node.removeAttribute(attr.name);
      } else if (/url\(\s*['"]?\s*(?!#)/.test(value) && name !== "d") {
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
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : `Layer ${index + 1}`;
}

function size(svg: Element): { width: number; height: number } | null {
  const box = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (box.length === 4 && box[2] > 0 && box[3] > 0) return { width: box[2], height: box[3] };
  const w = parseFloat(svg.getAttribute("width") ?? "");
  const h = parseFloat(svg.getAttribute("height") ?? "");
  return w > 0 && h > 0 ? { width: w, height: h } : null;
}

/** Reads a layered SVG file. Throws an Error with a message for the editor when it cannot be used. */
export function parseSvgPlan(text: string, name: string): SvgPlan {
  if (new Blob([text]).size > MAX_SVG_BYTES) {
    throw new Error("That SVG is over 1.5 MB. Ask for a lighter export (fewer embedded images), or simplify it.");
  }
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
    group.setAttribute("style", (group.getAttribute("style") ?? "").replace(/display\s*:\s*none;?/g, ""));
    return { key, label: layerName(group, index), on: !hiddenInFile };
  });

  /* Pixel size from the viewBox, so the drawing keeps its shape when drawn as an image. */
  svg.setAttribute("width", String(dims.width));
  svg.setAttribute("height", String(dims.height));
  if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", `0 0 ${dims.width} ${dims.height}`);

  return {
    name,
    svg: new XMLSerializer().serializeToString(svg),
    width: dims.width,
    height: dims.height,
    layers,
    sw: "",
    ne: "",
  };
}

/** Reads a plan saved in block props, or null. */
export function readPlan(value: unknown): SvgPlan | null {
  if (typeof value !== "object" || value === null) return null;
  const plan = value as Partial<SvgPlan>;
  if (typeof plan.svg !== "string" || !plan.svg || !Array.isArray(plan.layers)) return null;
  return {
    name: typeof plan.name === "string" ? plan.name : "plan.svg",
    svg: plan.svg,
    width: Number(plan.width) || 1,
    height: Number(plan.height) || 1,
    layers: plan.layers
      .filter((l): l is PlanLayer => typeof l?.key === "string")
      .map((l) => ({ key: l.key, label: typeof l.label === "string" ? l.label : l.key, on: l.on !== false })),
    sw: typeof plan.sw === "string" ? plan.sw : "",
    ne: typeof plan.ne === "string" ? plan.ne : "",
  };
}

/** Where the plan sits on the map, if both grid references are filled in and make sense. */
export function planCorners(plan: SvgPlan) {
  const sw = parseGridRef(plan.sw);
  const ne = parseGridRef(plan.ne);
  return sw && ne ? drawingCorners(sw, ne) : null;
}

/* One image per layer: the whole file with every other layer removed. */
const layerCache = new Map<string, string>();

/** A short, stable id for a plan's content, so a replaced file gets fresh map images. */
export function planId(plan: SvgPlan): string {
  let hash = 5381;
  for (let i = 0; i < plan.svg.length; i += Math.max(1, Math.floor(plan.svg.length / 4000))) {
    hash = ((hash << 5) + hash + plan.svg.charCodeAt(i)) | 0;
  }
  return `${(hash >>> 0).toString(36)}${plan.svg.length.toString(36)}`;
}

export function layerImage(plan: SvgPlan, key: string): string {
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
