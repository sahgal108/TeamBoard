import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { handle, readJson } from "@/lib/with-auth";
import { login } from "@/services/auth.service";
import { loginSchema } from "@/validations/auth.schema";

export const POST = handle(async req => {
  const input = loginSchema.parse(await readJson(req));
  const result = await login(input);

  const res = NextResponse.json({
    data: { user: result.user, companies: result.companies, activeCompanyId: result.activeCompanyId },
  });
  setSessionCookie(res, result.token);
  return res;
});
