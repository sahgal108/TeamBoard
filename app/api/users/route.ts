import { NextResponse } from "next/server";
import { listCompanyUsers } from "@/lib/authorization/company-users";
import { withAuth } from "@/lib/with-auth";

/** People in the caller's company, for assignee / member / PM pickers. */
export const GET = withAuth(async (_req, ctx) => {
  return NextResponse.json({ data: await listCompanyUsers(ctx) });
});
