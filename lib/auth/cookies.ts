import type { NextResponse } from "next/server";
import { SESSION_TTL_SECONDS } from "./jwt";

export const SESSION_COOKIE = "ws_session";

export function sessionCookieOptions(maxAge: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}
