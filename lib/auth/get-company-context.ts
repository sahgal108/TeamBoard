import type { NextRequest } from "next/server";
import type { CompanyRole } from "@/lib/db/enums";
import { Company, CompanyMember } from "@/lib/db/models";
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

  const membership = await CompanyMember.findOne({
    where: { companyId: claims.activeCompanyId, userId: user.id },
    attributes: ["id", "role"],
    include: [{ model: Company, as: "company", attributes: ["id", "name", "slug"] }],
  });
  if (!membership?.company) {
    throw new ForbiddenError("You are no longer a member of this company");
  }

  const { company } = membership;
  return {
    user,
    company: { id: company.id, name: company.name, slug: company.slug },
    membership: { id: membership.id, role: membership.role },
  };
}
