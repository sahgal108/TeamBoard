import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { handle } from "@/lib/with-auth";

export const POST = handle(async () => {
  const res = NextResponse.json({ data: { ok: true } });
  clearSessionCookie(res);
  return res;
});
