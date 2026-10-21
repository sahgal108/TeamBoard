import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/cookies";
import { readJson, withUser } from "@/lib/with-auth";
import { switchCompany } from "@/services/auth.service";
import { switchCompanySchema } from "@/validations/auth.schema";

// Needs a signed-in user, not a company context: the whole point is to change company.
export const POST = withUser(async (req, current) => {
  const { companyId } = switchCompanySchema.parse(await readJson(req));
  const result = await switchCompany(current.user.id, companyId);

  const res = NextResponse.json({ data: { company: result.company } });
  setSessionCookie(res, result.token);
  return res;
});
