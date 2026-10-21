import type { CompanyContext } from "@/lib/auth/get-company-context";
import { assertCan } from "@/lib/authorization/assert";
import { assertCompanyMember } from "@/lib/authorization/company-users";
import { authorizeTeam, loadTeamOrThrow } from "@/lib/authorization/team-access";
import { visibleProjectWhere, visibleTeamWhere } from "@/lib/authorization/visibility";
import { prisma } from "@/lib/db/prisma";
import { isUniqueViolation } from "@/lib/db/prisma-errors";
import { ValidationError } from "@/lib/errors";
import { cacheKeys } from "@/lib/redis/keys";
import { invalidate } from "@/lib/redis/cache";
import type { CreateTeamInput, UpdateTeamInput } from "@/validations/team.schema";
import { recordActivity } from "./activity.service";

export type TeamMemberDto = { id: string; name: string; email: string; role: string };
export type TeamListItem = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  projectCount: number;
  members: { id: string; name: string }[];
  isMember: boolean;
};

const memberSelect = {
  user: { select: { id: true, name: true, email: true, companyMemberships: { select: { role: true } } } },
} as const;

function duplicateName(err: unknown): never {
  if (isUniqueViolation(err)) throw new ValidationError({ name: ["A team with this name already exists"] }, "Team name already in use");
  throw err;
}

export async function listTeams(ctx: CompanyContext): Promise<TeamListItem[]> {
  const rows = await prisma.team.findMany({
    where: visibleTeamWhere(ctx),
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { members: true, projects: true } },
      members: { select: { userId: true, user: { select: { id: true, name: true } } }, take: 6, orderBy: { createdAt: "asc" } },
    },
  });
  return rows.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    memberCount: t._count.members,
    projectCount: t._count.projects,
    members: t.members.map(m => m.user),
    isMember: t.members.some(m => m.userId === ctx.user.id),
  }));
}

export async function getTeam(ctx: CompanyContext, teamId: string) {
  const { team, facts } = await authorizeTeam(ctx, teamId, "team:read");

  const [members, projects] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId: team.id },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, ...memberSelect },
    }),
    prisma.project.findMany({
      where: { AND: [visibleProjectWhere(ctx), { teamId: team.id }] },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, key: true, status: true,
        projectManager: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
    }),
  ]);

  return {
    ...team,
    members: members.map(m => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.user.companyMemberships[0]?.role ?? "MEMBER",
      joinedAt: m.createdAt.toISOString(),
    })),
    projects: projects.map(p => ({ ...p, taskCount: p._count.tasks })),
    permissions: {
      canEdit: facts.isTeamMember || ctx.membership.role === "CEO" || ctx.membership.role === "TECH_LEAD",
      canManageMembers: facts.isTeamMember || ctx.membership.role === "CEO" || ctx.membership.role === "TECH_LEAD",
    },
  };
}

export async function createTeam(ctx: CompanyContext, input: CreateTeamInput) {
  assertCan(ctx, "team:create");
  try {
    return await prisma.$transaction(async tx => {
      const team = await tx.team.create({
        data: { companyId: ctx.company.id, name: input.name, description: input.description ?? null },
        select: { id: true, name: true, description: true, companyId: true },
      });
      await recordActivity(tx, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "TEAM", entityId: team.id, teamId: team.id,
        action: "TEAM_CREATED", metadata: { name: team.name },
      });
      return team;
    });
  } catch (err) {
    duplicateName(err);
  } finally {
    await invalidate(cacheKeys.dashboard(ctx.company.id));
  }
}

export async function updateTeam(ctx: CompanyContext, teamId: string, input: UpdateTeamInput) {
  const { team } = await authorizeTeam(ctx, teamId, "team:update");
  try {
    return await prisma.$transaction(async tx => {
      const updated = await tx.team.update({
        where: { id: team.id },
        data: { name: input.name, description: input.description === undefined ? undefined : input.description },
        select: { id: true, name: true, description: true, companyId: true },
      });
      await recordActivity(tx, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "TEAM", entityId: team.id, teamId: team.id,
        action: "TEAM_UPDATED", metadata: { name: updated.name, changed: Object.keys(input) },
      });
      return updated;
    });
  } catch (err) {
    duplicateName(err);
  }
}

export async function deleteTeam(ctx: CompanyContext, teamId: string) {
  const { team } = await authorizeTeam(ctx, teamId, "team:delete");
  const projectCount = await prisma.project.count({ where: { teamId: team.id } });
  if (projectCount > 0) {
    throw new ValidationError({ teamId: ["Team still owns projects"] }, `Move or delete this team's ${projectCount} project(s) first`);
  }
  await prisma.$transaction(async tx => {
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TEAM", entityId: team.id,
      action: "TEAM_DELETED", metadata: { name: team.name },
    });
    await tx.team.delete({ where: { id: team.id } });
  });
  await invalidate(cacheKeys.dashboard(ctx.company.id));
}

export async function addTeamMember(ctx: CompanyContext, teamId: string, userId: string) {
  const { team } = await authorizeTeam(ctx, teamId, "team:manage_members");
  const user = await assertCompanyMember(ctx, userId);
  try {
    await prisma.$transaction(async tx => {
      await tx.teamMember.create({ data: { teamId: team.id, userId: user.id } });
      await recordActivity(tx, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "TEAM", entityId: team.id, teamId: team.id,
        action: "TEAM_MEMBER_ADDED", metadata: { team: team.name, userId: user.id, userName: user.name },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ValidationError({ userId: ["Already a member"] }, `${user.name} is already on ${team.name}`);
    throw err;
  }
  return user;
}

export async function removeTeamMember(ctx: CompanyContext, teamId: string, userId: string) {
  const { team } = await authorizeTeam(ctx, teamId, "team:manage_members");
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId } },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!membership) throw new ValidationError({ userId: ["Not a member"] }, "That person is not on this team");
  await prisma.$transaction(async tx => {
    await tx.teamMember.delete({ where: { id: membership.id } });
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TEAM", entityId: team.id, teamId: team.id,
      action: "TEAM_MEMBER_REMOVED", metadata: { team: team.name, userId, userName: membership.user.name },
    });
  });
}

export { loadTeamOrThrow };
