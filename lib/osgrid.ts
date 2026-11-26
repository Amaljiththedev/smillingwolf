/*
  Ordnance Survey National Grid references to latitude and longitude.

  Architects place drawings with OS grid references (eastings and northings
  on the OSGB36 datum). Web maps use WGS84 latitude and longitude, so each
  reference goes through:
    1. inverse Transverse Mercator on the Airy 1830 ellipsoid (OSGB36 lat/lng)
    2. a Helmert transform from OSGB36 to WGS84
  This is Ordnance Survey's published method; the Helmert step is good to
  a few metres, plenty for placing a plan on a street map.

  Accepted formats:
    "389500, 390100"         eastings, northings in metres
    "389500 390100"
    "SJ 89500 90100"         letters and digits (2, 4, 6, 8 or 10 digits)
    "SJ8950090100"
*/

export type GridRef = { easting: number; northing: number };

const AIRY = { a: 6_377_563.396, b: 6_356_256.909 };
const WGS84 = { a: 6_378_137, b: 6_356_752.314245 };
const F0 = 0.9996012717;
const PHI0 = (49 * Math.PI) / 180;
const LAMBDA0 = (-2 * Math.PI) / 180;
const N0 = -100_000;
const E0 = 400_000;

/** Reads a grid reference in any of the formats above. Returns null if it is not one. */
export function parseGridRef(input: string): GridRef | null {
  const text = input.trim().toUpperCase();
  if (!text) return null;

  const numeric = /^(\d{3,7}(?:\.\d+)?)\s*[,\s]\s*(\d{3,7}(?:\.\d+)?)$/.exec(text);
  if (numeric) return inGrid({ easting: Number(numeric[1]), northing: Number(numeric[2]) });

  const lettered = /^([A-HJ-Z])([A-HJ-Z])\s*(\d+)\s*(\d*)$/.exec(text);
  if (!lettered) return null;
  let digits = lettered[3] + lettered[4];
  if (lettered[4] && lettered[3].length !== lettered[4].length) return null;
  if (digits.length % 2 !== 0 || digits.length < 2 || digits.length > 10) return null;
  const half = digits.length / 2;
  let l1 = lettered[1].charCodeAt(0) - 65;
  let l2 = lettered[2].charCodeAt(0) - 65;
  if (l1 > 7) l1--;
  if (l2 > 7) l2--;
  const e100 = ((l1 - 2) % 5) * 5 + (l2 % 5);
  const n100 = 19 - Math.floor(l1 / 5) * 5 - Math.floor(l2 / 5);
  if (e100 < 0 || e100 > 6 || n100 < 0 || n100 > 12) return null;
  digits = digits.slice(0, half).padEnd(5, "0") + digits.slice(half).padEnd(5, "0");
  return inGrid({ easting: e100 * 100_000 + Number(digits.slice(0, 5)), northing: n100 * 100_000 + Number(digits.slice(5)) });
}

function inGrid(ref: GridRef): GridRef | null {
  return ref.easting >= 0 && ref.easting <= 700_000 && ref.northing >= 0 && ref.northing <= 1_300_000 ? ref : null;
}

/** OS grid reference to WGS84 [lat, lng] in degrees. */
export function gridToLatLng({ easting: E, northing: N }: GridRef): [number, number] {
  const { a, b } = AIRY;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n2 * n;

  /* Latitude by iteration until the meridional arc matches the northing. */
  let phi = PHI0;
  let M = 0;
  do {
    phi = (N - N0 - M) / (a * F0) + phi;
    const dPhi = phi - PHI0;
    const sPhi = phi + PHI0;
    M =
      b *
      F0 *
      ((1 + n + (5 / 4) * n2 + (5 / 4) * n3) * dPhi -
        (3 * n + 3 * n2 + (21 / 8) * n3) * Math.sin(dPhi) * Math.cos(sPhi) +
        ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * dPhi) * Math.cos(2 * sPhi) -
        (35 / 24) * n3 * Math.sin(3 * dPhi) * Math.cos(3 * sPhi));
  } while (Math.abs(N - N0 - M) >= 0.00001);

  const sin = Math.sin(phi);
  const nu = (a * F0) / Math.sqrt(1 - e2 * sin * sin);
  const rho = (a * F0 * (1 - e2)) / Math.pow(1 - e2 * sin * sin, 1.5);
  const eta2 = nu / rho - 1;
  const tan = Math.tan(phi);
  const tan2 = tan * tan;
  const tan4 = tan2 * tan2;
  const tan6 = tan4 * tan2;
  const sec = 1 / Math.cos(phi);
  const nu3 = nu * nu * nu;
  const nu5 = nu3 * nu * nu;
  const nu7 = nu5 * nu * nu;

  const VII = tan / (2 * rho * nu);
  const VIII = (tan / (24 * rho * nu3)) * (5 + 3 * tan2 + eta2 - 9 * tan2 * eta2);
  const IX = (tan / (720 * rho * nu5)) * (61 + 90 * tan2 + 45 * tan4);
  const X = sec / nu;
  const XI = (sec / (6 * nu3)) * (nu / rho + 2 * tan2);
  const XII = (sec / (120 * nu5)) * (5 + 28 * tan2 + 24 * tan4);
  const XIIA = (sec / (5040 * nu7)) * (61 + 662 * tan2 + 1320 * tan4 + 720 * tan6);

  const dE = E - E0;
  const latOsgb = phi - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6;
  const lngOsgb = LAMBDA0 + X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7;

  return toWgs84(latOsgb, lngOsgb);
}

/** OSGB36 (radians) to WGS84 (degrees) through 3D cartesian coordinates and a Helmert transform. */
function toWgs84(lat: number, lng: number): [number, number] {
  const airyE2 = 1 - (AIRY.b * AIRY.b) / (AIRY.a * AIRY.a);
  const nu = AIRY.a / Math.sqrt(1 - airyE2 * Math.sin(lat) ** 2);
  const x1 = nu * Math.cos(lat) * Math.cos(lng);
  const y1 = nu * Math.cos(lat) * Math.sin(lng);
  const z1 = (1 - airyE2) * nu * Math.sin(lat);

  /* OSGB36 to WGS84 (Ordnance Survey's published parameters). */
  const tx = 446.448;
  const ty = -125.157;
  const tz = 542.06;
  const s = -20.4894 / 1e6 + 1;
  const arc = (seconds: number) => ((seconds / 3600) * Math.PI) / 180;
  const rx = arc(0.1502);
  const ry = arc(0.247);
  const rz = arc(0.8421);
  const x2 = tx + x1 * s - y1 * rz + z1 * ry;
  const y2 = ty + x1 * rz + y1 * s - z1 * rx;
  const z2 = tz - x1 * ry + y1 * rx + z1 * s;

  const e2 = 1 - (WGS84.b * WGS84.b) / (WGS84.a * WGS84.a);
  const p = Math.sqrt(x2 * x2 + y2 * y2);
  let phi = Math.atan2(z2, p * (1 - e2));
  for (let i = 0; i < 10; i++) {
    const v = WGS84.a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    phi = Math.atan2(z2 + e2 * v * Math.sin(phi), p);
  }
  return [(phi * 180) / Math.PI, (Math.atan2(y2, x2) * 180) / Math.PI];
}

/**
 * The four corners of a north-up drawing whose bottom-left and top-right
 * corners sit on these grid references, as [lng, lat] in the order MapLibre
 * wants for an image: top-left, top-right, bottom-right, bottom-left.
 * Grid north and true north differ slightly, so all four are converted.
 */
export function drawingCorners(sw: GridRef, ne: GridRef): [[number, number], [number, number], [number, number], [number, number]] | null {
  if (ne.easting <= sw.easting || ne.northing <= sw.northing) return null;
  const at = (easting: number, northing: number): [number, number] => {
    const [lat, lng] = gridToLatLng({ easting, northing });
    return [lng, lat];
  };
  return [
    at(sw.easting, ne.northing),
    at(ne.easting, ne.northing),
    at(ne.easting, sw.northing),
    at(sw.easting, sw.northing),
  ];
}
