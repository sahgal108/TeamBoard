import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

// Optimistic check only: the presence of a session cookie decides redirects between the
// public and signed-in halves of the app. Real authentication and tenant checks happen per
// request in getCompanyContext(); this never touches the database.
const PROTECTED_PREFIXES = ["/dashboard", "/teams", "/projects", "/tasks", "/activity", "/settings", "/search"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/dashboard" : "/login", req.url));
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (!hasSession && PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/teams/:path*", "/projects/:path*", "/tasks/:path*", "/activity/:path*", "/settings/:path*", "/search/:path*"],
};
