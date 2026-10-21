import type { CompanyRole } from "@/generated/prisma/enums";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors";

export type CompanyUser = { id: string; name: string; email: string; role: CompanyRole };

/** People inside the caller's company, for assignee / member / PM pickers. Tenant-scoped. */
export async function listCompanyUsers(ctx: CompanyContext): Promise<CompanyUser[]> {
  const rows = await prisma.companyMember.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { user: { name: "asc" } },
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map(r => ({ ...r.user, role: r.role }));
}

/**
 * Any userId taken from client input (assignee, new member, project manager) must be a member
 * of the caller's company. Otherwise a client could attach a stranger to a tenant's data.
 */
export async function assertCompanyMember(ctx: CompanyContext, userId: string, what = "User"): Promise<CompanyUser> {
  const row = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: ctx.company.id, userId } },
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
  });
  if (!row) throw new ValidationError({ userId: ["Not a member of this company"] }, `${what} is not a member of this company`);
  return { ...row.user, role: row.role };
}
