import { Op } from "sequelize";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { assertCan } from "@/lib/authorization/assert";
import { assertCompanyMember } from "@/lib/authorization/company-users";
import { authorizeTeam, loadTeamOrThrow } from "@/lib/authorization/team-access";
import { visibleProjectWhere, visibleTeamWhere } from "@/lib/authorization/visibility";
import { isUniqueViolation } from "@/lib/db/errors";
import { countBy } from "@/lib/db/queries";
import { CompanyMember, Project, Task, Team, TeamMember, User, sequelize } from "@/lib/db/models";
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

const MEMBER_PREVIEW = 6;

function duplicateName(err: unknown): never {
  if (isUniqueViolation(err)) throw new ValidationError({ name: ["A team with this name already exists"] }, "Team name already in use");
  throw err;
}

export async function listTeams(ctx: CompanyContext): Promise<TeamListItem[]> {
  const teams = await Team.findAll({ where: visibleTeamWhere(ctx), attributes: ["id", "name", "description"], order: [["name", "ASC"]] });
  const ids = teams.map(t => t.id);
  const [memberCounts, projectCounts, members] = await Promise.all([
    countBy(TeamMember, "teamId", ids),
    countBy(Project, "teamId", ids),
    ids.length === 0
      ? []
      : TeamMember.findAll({
          where: { teamId: { [Op.in]: ids } },
          attributes: ["teamId", "userId"],
          include: [{ model: User, as: "user", attributes: ["id", "name"] }],
          order: [["createdAt", "ASC"]],
        }),
  ]);

  const byTeam = new Map<string, TeamMember[]>();
  for (const m of members) byTeam.set(m.teamId, [...(byTeam.get(m.teamId) ?? []), m]);

  return teams.map(t => {
    const teamMembers = byTeam.get(t.id) ?? [];
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      memberCount: memberCounts.get(t.id) ?? 0,
      projectCount: projectCounts.get(t.id) ?? 0,
      members: teamMembers.slice(0, MEMBER_PREVIEW).map(m => ({ id: m.user!.id, name: m.user!.name })),
      isMember: teamMembers.some(m => m.userId === ctx.user.id),
    };
  });
}

export async function getTeam(ctx: CompanyContext, teamId: string) {
  const { team, facts } = await authorizeTeam(ctx, teamId, "team:read");

  const [members, projects] = await Promise.all([
    TeamMember.findAll({
      where: { teamId: team.id },
      attributes: ["createdAt"],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
          include: [{ model: CompanyMember, as: "companyMemberships", attributes: ["role"], where: { companyId: ctx.company.id }, required: false }],
        },
      ],
      order: [["createdAt", "ASC"]],
    }),
    Project.findAll({
      where: { [Op.and]: [visibleProjectWhere(ctx), { teamId: team.id }] },
      attributes: ["id", "name", "key", "status"],
      include: [{ model: User, as: "projectManager", attributes: ["id", "name"] }],
      order: [["name", "ASC"]],
    }),
  ]);
  const taskCounts = await countBy(Task, "projectId", projects.map(p => p.id));

  return {
    ...team,
    members: members.map(m => ({
      id: m.user!.id,
      name: m.user!.name,
      email: m.user!.email,
      role: m.user!.companyMemberships?.[0]?.role ?? "MEMBER",
      joinedAt: m.createdAt.toISOString(),
    })),
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      key: p.key,
      status: p.status,
      projectManager: p.projectManager ? { id: p.projectManager.id, name: p.projectManager.name } : null,
      taskCount: taskCounts.get(p.id) ?? 0,
    })),
    permissions: {
      canEdit: facts.isTeamMember || ctx.membership.role === "CEO" || ctx.membership.role === "TECH_LEAD",
      canManageMembers: facts.isTeamMember || ctx.membership.role === "CEO" || ctx.membership.role === "TECH_LEAD",
    },
  };
}

const teamDto = (t: Team) => ({ id: t.id, name: t.name, description: t.description, companyId: t.companyId });

export async function createTeam(ctx: CompanyContext, input: CreateTeamInput) {
  assertCan(ctx, "team:create");
  try {
    return await sequelize.transaction(async transaction => {
      const team = await Team.create({ companyId: ctx.company.id, name: input.name, description: input.description ?? null }, { transaction });
      await recordActivity(transaction, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "TEAM", entityId: team.id, teamId: team.id,
        action: "TEAM_CREATED", metadata: { name: team.name },
      });
      return teamDto(team);
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
    return await sequelize.transaction(async transaction => {
      const row = await Team.findByPk(team.id, { transaction, rejectOnEmpty: true });
      if (input.name !== undefined) row.name = input.name;
      if (input.description !== undefined) row.description = input.description;
      await row.save({ transaction });
      await recordActivity(transaction, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "TEAM", entityId: team.id, teamId: team.id,
        action: "TEAM_UPDATED", metadata: { name: row.name, changed: Object.keys(input) },
      });
      return teamDto(row);
    });
  } catch (err) {
    duplicateName(err);
  }
}

export async function deleteTeam(ctx: CompanyContext, teamId: string) {
  const { team } = await authorizeTeam(ctx, teamId, "team:delete");
  const projectCount = await Project.count({ where: { teamId: team.id } });
  if (projectCount > 0) {
    throw new ValidationError({ teamId: ["Team still owns projects"] }, `Move or delete this team's ${projectCount} project(s) first`);
  }
  await sequelize.transaction(async transaction => {
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TEAM", entityId: team.id,
      action: "TEAM_DELETED", metadata: { name: team.name },
    });
    await Team.destroy({ where: { id: team.id }, transaction });
  });
  await invalidate(cacheKeys.dashboard(ctx.company.id));
}

export async function addTeamMember(ctx: CompanyContext, teamId: string, userId: string) {
  const { team } = await authorizeTeam(ctx, teamId, "team:manage_members");
  const user = await assertCompanyMember(ctx, userId);
  try {
    await sequelize.transaction(async transaction => {
      await TeamMember.create({ teamId: team.id, userId: user.id }, { transaction });
      await recordActivity(transaction, {
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
  const membership = await TeamMember.findOne({
    where: { teamId: team.id, userId },
    attributes: ["id"],
    include: [{ model: User, as: "user", attributes: ["name"] }],
  });
  if (!membership) throw new ValidationError({ userId: ["Not a member"] }, "That person is not on this team");
  await sequelize.transaction(async transaction => {
    await TeamMember.destroy({ where: { id: membership.id }, transaction });
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TEAM", entityId: team.id, teamId: team.id,
      action: "TEAM_MEMBER_REMOVED", metadata: { team: team.name, userId, userName: membership.user?.name },
    });
  });
}

export { loadTeamOrThrow };
