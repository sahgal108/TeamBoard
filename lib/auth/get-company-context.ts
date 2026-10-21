import type { NextRequest } from "next/server";
import type { CompanyRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";
import { getCurrentUser } from "./get-current-user";

/** Everything the authorization layer needs about the caller. Built once per request. */
export type CompanyContext = {
  user: { id: string; name: string; email: string };
  company: { id: string; name: string; slug: string };
  membership: { id: string; role: CompanyRole };
};

/**
 * The tenant boundary. Resolves the active company from the session claim and then
 * PROVES membership with a fresh CompanyMember lookup. A stale or forged claim for a
 * company the user does not belong to yields 403, never a context.
 */
export async function getCompanyContext(req?: NextRequest): Promise<CompanyContext> {
  const { user, claims } = await getCurrentUser(req);

  if (!claims.activeCompanyId) {
    throw new ForbiddenError("You are not a member of any company");
  }

  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: claims.activeCompanyId, userId: user.id } },
    select: { id: true, role: true, company: { select: { id: true, name: true, slug: true } } },
  });
  if (!membership) {
    throw new ForbiddenError("You are no longer a member of this company");
  }

  return {
    user,
    company: membership.company,
    membership: { id: membership.id, role: membership.role },
  };
}
