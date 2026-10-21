import { jwtVerify, SignJWT } from "jose";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** What the session cookie carries. The active company is a claim, but it is re-verified
 *  against CompanyMember on every request (see get-company-context.ts). */
export type SessionClaims = {
  /** user id */
  sub: string;
  /** company the user is currently operating in; null when they belong to none */
  activeCompanyId: string | null;
};

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims, ttlSeconds: number = SESSION_TTL_SECONDS): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ activeCompanyId: claims.activeCompanyId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(secretKey());
}

/** Returns null for anything that is not a valid, unexpired token we signed. Never throws on bad input. */
export async function verifySession(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
    const active = payload.activeCompanyId;
    return { sub: payload.sub, activeCompanyId: typeof active === "string" ? active : null };
  } catch {
    return null;
  }
}
