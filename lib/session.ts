/*
  Signed session token. Pure Web Crypto, so this file is safe to import from
  middleware (edge runtime) as well as from server components and actions.
  Cookie helpers that need next/headers live in lib/auth.ts instead.
*/

export const SESSION_COOKIE = "openplan_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

/* Dev default. Set AUTH_SECRET in the environment before this goes anywhere real. */
const SECRET = process.env.AUTH_SECRET ?? "openplan-dev-secret-change-before-launch";

export type Session = {
  email: string;
  /** Display name, derived from the email until there are real accounts. */
  name: string;
  /** Issued-at, epoch ms. */
  iat: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let cachedKey: Promise<CryptoKey> | null = null;

function signingKey(): Promise<CryptoKey> {
  cachedKey ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return cachedKey;
}

/** Turns an email into something readable: "jo.bloggs@x.gov.uk" to "Jo Bloggs". */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const words = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.length > 0 ? words.join(" ") : email;
}

export async function signSession(session: Session): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Returns the session when the token is well formed, correctly signed and unexpired. */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      fromBase64Url(signature),
      encoder.encode(payload),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const session = JSON.parse(decoder.decode(fromBase64Url(payload))) as Session;
    if (typeof session.email !== "string" || typeof session.iat !== "number") return null;
    if (Date.now() - session.iat > SESSION_MAX_AGE * 1000) return null;
    return session;
  } catch {
    return null;
  }
}
