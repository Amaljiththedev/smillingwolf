/*
  Placing a masterplan drawing on the real map. The drawing is a flat image,
  so we give it a footprint on the ground (centred on the scheme) and convert
  "% from left / % from top" comment positions into longitude and latitude.
*/

export type Bounds = { west: number; south: number; east: number; north: number };

/** Ground footprint of a plan drawing, `metres` wide, keeping the drawing's proportions. */
export function planBounds(centre: [number, number], width: number, height: number, metres = 560): Bounds {
  const [lat, lng] = centre;
  const ratio = width > 0 && height > 0 ? height / width : 2 / 3;
  const halfLat = (metres * ratio) / 111_320 / 2;
  const halfLng = metres / (111_320 * Math.cos((lat * Math.PI) / 180)) / 2;
  return { west: lng - halfLng, east: lng + halfLng, south: lat - halfLat, north: lat + halfLat };
}

/** A point on the plan (% from left, % from top) as [lng, lat]. */
export function planPoint(b: Bounds, x: number, y: number): [number, number] {
  return [b.west + (x / 100) * (b.east - b.west), b.north - (y / 100) * (b.north - b.south)];
}

/** Grows a footprint by a share of its size, for a little room around the plan. */
export function pad(b: Bounds, share = 0.15): Bounds {
  const dx = (b.east - b.west) * share;
  const dy = (b.north - b.south) * share;
  return { west: b.west - dx, east: b.east + dx, south: b.south - dy, north: b.north + dy };
}

/** Demo pins scattered round a centre, the same every time, for previews with no real comments. */
export function demoPins(centre: [number, number], count: number): { id: string; lng: number; lat: number; tone: "pos" | "neg" | "" }[] {
  const tones = ["neg", "pos", "", "neg", "pos", ""] as const;
  return Array.from({ length: count }, (_, i) => {
    const angle = i * 2.4;
    const r = 0.0009 + (i % 3) * 0.0006;
    return { id: `demo-${i}`, lat: centre[0] + Math.sin(angle) * r * 0.6, lng: centre[1] + Math.cos(angle) * r, tone: tones[i % tones.length] };
  });
}
