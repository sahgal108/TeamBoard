import type { Action, Facts } from "@/lib/auth/permissions";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import { assertCan } from "./assert";

export type LoadedTeam = { id: string; companyId: string; name: string; description: string | null };

/** Tenant-scoped load. A team in another company is indistinguishable from a missing one. */
export async function loadTeamOrThrow(ctx: CompanyContext, teamId: string): Promise<LoadedTeam> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, companyId: ctx.company.id },
    select: { id: true, companyId: true, name: true, description: true },
  });
  if (!team) throw new NotFoundError("Team");
  return team;
}

export async function teamFacts(ctx: CompanyContext, teamId: string): Promise<Facts> {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: ctx.user.id } },
    select: { id: true },
  });
  return { isTeamMember: membership !== null };
}

/** Steps 3–5 of the pipeline for a team: load tenant-scoped, gather facts, check policy. */
export async function authorizeTeam(ctx: CompanyContext, teamId: string, action: Action) {
  const team = await loadTeamOrThrow(ctx, teamId);
  const facts = await teamFacts(ctx, team.id);
  assertCan(ctx, action, facts);
  return { team, facts };
}
