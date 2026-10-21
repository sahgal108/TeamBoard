import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { UnauthorizedError } from "@/lib/errors";
import { SESSION_COOKIE } from "./cookies";
import { verifySession, type SessionClaims } from "./jwt";

export type CurrentUser = {
  user: { id: string; name: string; email: string };
  claims: SessionClaims;
};

/** Reads the session token from the request (route handlers) or from the request-scoped
 *  cookie store (server components / actions) when no request is passed. */
export async function readSessionToken(req?: NextRequest): Promise<string | undefined> {
  if (req) return req.cookies.get(SESSION_COOKIE)?.value;
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

/** Authenticated user or UnauthorizedError. Does not care about companies; see getCompanyContext. */
export async function getCurrentUser(req?: NextRequest): Promise<CurrentUser> {
  const claims = await verifySession(await readSessionToken(req));
  if (!claims) throw new UnauthorizedError();

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, name: true, email: true },
  });
  // The token was valid but the account is gone: treat exactly like no session.
  if (!user) throw new UnauthorizedError();

  return { user, claims };
}
