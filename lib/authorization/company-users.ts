import type { CompanyContext } from "@/lib/auth/get-company-context";
import type { CompanyRole } from "@/lib/db/enums";
import { CompanyMember, User } from "@/lib/db/models";
import { ValidationError } from "@/lib/errors";

export type CompanyUser = { id: string; name: string; email: string; role: CompanyRole };

const withUser = { model: User, as: "user", attributes: ["id", "name", "email"] };

const toCompanyUser = (m: CompanyMember): CompanyUser => ({ id: m.user!.id, name: m.user!.name, email: m.user!.email, role: m.role });

/** People inside the caller's company, for assignee / member / PM pickers. Tenant-scoped. */
export async function listCompanyUsers(ctx: CompanyContext): Promise<CompanyUser[]> {
  const rows = await CompanyMember.findAll({
    where: { companyId: ctx.company.id },
    attributes: ["role"],
    include: [withUser],
    order: [[{ model: User, as: "user" }, "name", "ASC"]],
  });
  return rows.map(toCompanyUser);
}

/**
 * Any userId taken from client input (assignee, new member, project manager) must be a member
 * of the caller's company. Otherwise a client could attach a stranger to a tenant's data.
 */
export async function assertCompanyMember(ctx: CompanyContext, userId: string, what = "User"): Promise<CompanyUser> {
  const row = await CompanyMember.findOne({ where: { companyId: ctx.company.id, userId }, attributes: ["role"], include: [withUser] });
  if (!row?.user) throw new ValidationError({ userId: ["Not a member of this company"] }, `${what} is not a member of this company`);
  return toCompanyUser(row);
}
