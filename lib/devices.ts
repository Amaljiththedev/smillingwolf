import { Monitor, Smartphone, Tablet } from "lucide-react";

/*
  Device sizes for previewing a page. Shared by the editor canvas, the
  full-page preview and the preview route, so all show the same widths.
  Kept out of the client components so server code can use it too.
*/

export type Device = "desktop" | "tablet" | "phone";

export const DEVICES: { key: Device; label: string; icon: typeof Monitor; width: number }[] = [
  { key: "desktop", label: "Desktop", icon: Monitor, width: 1280 },
  { key: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { key: "phone", label: "Phone", icon: Smartphone, width: 390 },
];

export function isDevice(value: unknown): value is Device {
  return value === "desktop" || value === "tablet" || value === "phone";
}

/* Below this the desktop preview would stop looking like a desktop. */
const DESKTOP_MIN = 1024;
const PHONE_BEZEL = 14;

/**
 * The width to lay the page out at, and how far to scale it to fit the
 * space available. Desktop fills the space between 1024 and 1280px.
 */
export function frameFor(device: Device, available: number | null): { width: number; zoom: number } {
  const space = Math.max(1, (available ?? 1280) - (device === "phone" ? PHONE_BEZEL : 0));
  const target = DEVICES.find((d) => d.key === device)!.width;
  const width = device === "desktop" ? Math.round(Math.min(target, Math.max(DESKTOP_MIN, space))) : target;
  const zoom = Math.min(1, space / width);
  return { width, zoom: Math.round(zoom * 1000) / 1000 };
}
