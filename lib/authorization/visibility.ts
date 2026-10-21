import type { Prisma } from "@/generated/prisma/client";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { hasFullAccess } from "@/lib/auth/permissions";

/**
 * Prisma `where` fragments that apply the caller's visibility IN SQL. Every list endpoint and
 * search uses these, so no list can ever include a project or task the caller could not open.
 */
export function visibleProjectWhere(ctx: CompanyContext): Prisma.ProjectWhereInput {
  const base: Prisma.ProjectWhereInput = { companyId: ctx.company.id };
  if (hasFullAccess(ctx.membership.role)) return base;
  const userId = ctx.user.id;
  return {
    ...base,
    OR: [
      { projectManagerId: userId },
      { members: { some: { userId } } },
      { team: { members: { some: { userId } } } },
    ],
  };
}

export function visibleTaskWhere(ctx: CompanyContext): Prisma.TaskWhereInput {
  return { companyId: ctx.company.id, project: visibleProjectWhere(ctx) };
}

/** Teams are company-wide readable; this exists so callers never forget the tenant filter. */
export function visibleTeamWhere(ctx: CompanyContext): Prisma.TeamWhereInput {
  return { companyId: ctx.company.id };
}

export function visibleActivityWhere(ctx: CompanyContext): Prisma.ActivityWhereInput {
  const base: Prisma.ActivityWhereInput = { companyId: ctx.company.id };
  if (hasFullAccess(ctx.membership.role)) return base;
  const userId = ctx.user.id;
  return {
    ...base,
    OR: [
      // Anything scoped to a project the caller can see
      { project: visibleProjectWhere(ctx) },
      // Team events for teams the caller belongs to
      { team: { members: { some: { userId } } } },
      // Their own actions
      { userId },
    ],
  };
}
