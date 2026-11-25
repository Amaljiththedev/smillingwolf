import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  nameFromEmail,
  signSession,
  verifySession,
  type Session,
} from "@/lib/session";

/*
  Cookie-backed auth for server components and server actions.
  Middleware uses lib/session.ts directly, because next/headers is not
  available in the edge runtime.
*/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
  PROTOTYPE ONLY. Every password is accepted; only the shape of the email and
  a non-empty password are checked. This is the single function to replace
  when real accounts arrive: look the user up, compare a hashed password, and
  return false on any mismatch. Nothing else in the auth flow needs changing.
*/
export function checkCredentials(email: string, password: string): boolean {
  return EMAIL_RE.test(email.trim()) && password.length > 0;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function createSession(email: string): Promise<void> {
  const trimmed = email.trim();
  const token = await signSession({
    email: trimmed,
    name: nameFromEmail(trimmed),
    iat: Date.now(),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
