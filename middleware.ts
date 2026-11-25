import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/*
  Guards the builder. An unsigned, tampered or expired cookie sends the
  person to the log-in page, carrying where they were headed so they land
  back there afterwards.
*/
export async function middleware(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  const response = NextResponse.redirect(url);
  /* Clear a bad cookie so it cannot keep failing. */
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: ["/builder/:path*"],
};
