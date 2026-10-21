import { NextResponse } from "next/server";
import { signSession } from "@/lib/auth/jwt";
import { withAuth } from "@/lib/with-auth";

const SOCKET_TOKEN_TTL_SECONDS = 10 * 60;

/**
 * Mints a short-lived token the browser can hand to the realtime server. Same signing key and
 * claims as the session, but ten minutes instead of seven days, since it travels in JS.
 */
export const GET = withAuth(async (_req, ctx) => {
  const token = await signSession({ sub: ctx.user.id, activeCompanyId: ctx.company.id }, SOCKET_TOKEN_TTL_SECONDS);
  return NextResponse.json({ data: { token, expiresIn: SOCKET_TOKEN_TTL_SECONDS } }, { headers: { "cache-control": "no-store" } });
});
