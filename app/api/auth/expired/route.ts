import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";

const REASONS = new Set(["expired", "no-company"]);

/**
 * Where pages send a request whose session cookie no longer works (account deleted, token
 * expired or signed with an old secret, membership removed). Server components cannot clear
 * cookies, and proxy.ts bounces /login back to the app while the cookie exists, so the cookie
 * is cleared here before going to sign-in.
 */
export function GET(req: NextRequest) {
  const reason = req.nextUrl.searchParams.get("reason");
  const login = new URL("/login", req.url);
  login.searchParams.set("reason", reason && REASONS.has(reason) ? reason : "expired");
  const res = NextResponse.redirect(login, 303);
  clearSessionCookie(res);
  return res;
}
