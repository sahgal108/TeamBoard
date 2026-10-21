import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { listCompanies } from "@/services/auth.service";

export const GET = withAuth(async (_req, ctx) => {
  const companies = await listCompanies(ctx.user.id);
  return NextResponse.json({
    data: {
      user: ctx.user,
      company: ctx.company,
      role: ctx.membership.role,
      companies,
    },
  });
});
