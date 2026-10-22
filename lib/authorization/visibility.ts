import { Op, literal, type WhereOptions } from "sequelize";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { hasFullAccess } from "@/lib/auth/permissions";
import { sequelize } from "@/lib/db/sequelize";

/**
 * `where` fragments that apply the caller's visibility IN SQL. Every list endpoint and search
 * uses these, so no list can ever include a project or task the caller could not open.
 * Ids are escaped by Sequelize before they are placed in the subqueries.
 */

const esc = (value: string) => sequelize.escape(value);

/** Subquery selecting the ids of every project the caller may open. */
function visibleProjectIdsSql(ctx: CompanyContext): string {
  const company = esc(ctx.company.id);
  if (hasFullAccess(ctx.membership.role)) return `SELECT "id" FROM "Project" WHERE "companyId" = ${company}`;
  const user = esc(ctx.user.id);
  return `SELECT p."id" FROM "Project" p WHERE p."companyId" = ${company} AND (
    p."projectManagerId" = ${user}
    OR EXISTS (SELECT 1 FROM "ProjectMember" pm WHERE pm."projectId" = p."id" AND pm."userId" = ${user})
    OR EXISTS (SELECT 1 FROM "TeamMember" tm WHERE tm."teamId" = p."teamId" AND tm."userId" = ${user})
  )`;
}

/** Subquery selecting the ids of the teams the caller belongs to. */
const myTeamIdsSql = (ctx: CompanyContext) => `SELECT "teamId" FROM "TeamMember" WHERE "userId" = ${esc(ctx.user.id)}`;

export function visibleProjectWhere(ctx: CompanyContext): WhereOptions {
  if (hasFullAccess(ctx.membership.role)) return { companyId: ctx.company.id };
  return { companyId: ctx.company.id, id: { [Op.in]: literal(`(${visibleProjectIdsSql(ctx)})`) } };
}

export function visibleTaskWhere(ctx: CompanyContext): WhereOptions {
  if (hasFullAccess(ctx.membership.role)) return { companyId: ctx.company.id };
  return { companyId: ctx.company.id, projectId: { [Op.in]: literal(`(${visibleProjectIdsSql(ctx)})`) } };
}

/** Teams are company-wide readable; this exists so callers never forget the tenant filter. */
export function visibleTeamWhere(ctx: CompanyContext): WhereOptions {
  return { companyId: ctx.company.id };
}

export function visibleActivityWhere(ctx: CompanyContext): WhereOptions {
  if (hasFullAccess(ctx.membership.role)) return { companyId: ctx.company.id };
  return {
    companyId: ctx.company.id,
    [Op.or]: [
      // Anything scoped to a project the caller can see
      { projectId: { [Op.in]: literal(`(${visibleProjectIdsSql(ctx)})`) } },
      // Team events for teams the caller belongs to
      { teamId: { [Op.in]: literal(`(${myTeamIdsSql(ctx)})`) } },
      // Their own actions
      { userId: ctx.user.id },
    ],
  };
}

/** Teams the caller belongs to, as a where fragment on Team. */
export function myTeamsWhere(ctx: CompanyContext): WhereOptions {
  return { companyId: ctx.company.id, id: { [Op.in]: literal(`(${myTeamIdsSql(ctx)})`) } };
}
