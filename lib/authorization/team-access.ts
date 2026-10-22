import type { Action, Facts } from "@/lib/auth/permissions";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { Team, TeamMember } from "@/lib/db/models";
import { NotFoundError } from "@/lib/errors";
import { assertCan } from "./assert";

export type LoadedTeam = { id: string; companyId: string; name: string; description: string | null };

/** Tenant-scoped load. A team in another company is indistinguishable from a missing one. */
export async function loadTeamOrThrow(ctx: CompanyContext, teamId: string): Promise<LoadedTeam> {
  const team = await Team.findOne({ where: { id: teamId, companyId: ctx.company.id }, attributes: ["id", "companyId", "name", "description"] });
  if (!team) throw new NotFoundError("Team");
  return { id: team.id, companyId: team.companyId, name: team.name, description: team.description };
}

export async function teamFacts(ctx: CompanyContext, teamId: string): Promise<Facts> {
  const membership = await TeamMember.findOne({ where: { teamId, userId: ctx.user.id }, attributes: ["id"] });
  return { isTeamMember: membership !== null };
}

/** Steps 3–5 of the pipeline for a team: load tenant-scoped, gather facts, check policy. */
export async function authorizeTeam(ctx: CompanyContext, teamId: string, action: Action) {
  const team = await loadTeamOrThrow(ctx, teamId);
  const facts = await teamFacts(ctx, team.id);
  assertCan(ctx, action, facts);
  return { team, facts };
}
