import { Op, QueryTypes, col, fn, type Transaction, type WhereOptions } from "sequelize";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { can } from "@/lib/auth/permissions";
import { assertCan } from "@/lib/authorization/assert";
import { assertCompanyMember } from "@/lib/authorization/company-users";
import { authorizeProject } from "@/lib/authorization/project-access";
import { loadTeamOrThrow } from "@/lib/authorization/team-access";
import { visibleProjectWhere } from "@/lib/authorization/visibility";
import type { ProjectStatus, TaskStatus } from "@/lib/db/enums";
import { isUniqueViolation } from "@/lib/db/errors";
import { Project, ProjectMember, Task, Team, User, sequelize } from "@/lib/db/models";
import { ValidationError } from "@/lib/errors";
import { publishProjectEvent } from "@/lib/realtime/publish";
import { getOrSet, invalidate } from "@/lib/redis/cache";
import { cacheKeys, cacheTtlSeconds } from "@/lib/redis/keys";
import type { CreateProjectInput, UpdateProjectInput } from "@/validations/project.schema";
import { recordActivity } from "./activity.service";

export type TaskCounts = Record<TaskStatus, number>;
export type ProjectListItem = {
  id: string;
  name: string;
  key: string;
  status: ProjectStatus;
  description: string | null;
  team: { id: string; name: string };
  projectManager: { id: string; name: string } | null;
  taskCount: number;
  doneCount: number;
  progress: number;
};

const emptyCounts = (): TaskCounts => ({ TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 });

async function taskCountsFor(projectIds: string[]): Promise<Map<string, TaskCounts>> {
  const map = new Map<string, TaskCounts>();
  if (projectIds.length === 0) return map;
  const grouped = (await Task.findAll({
    where: { projectId: { [Op.in]: projectIds } },
    attributes: ["projectId", "status", [fn("COUNT", col("id")), "count"]],
    group: ["projectId", "status"],
    raw: true,
  })) as unknown as { projectId: string; status: TaskStatus; count: string }[];
  for (const g of grouped) {
    const counts = map.get(g.projectId) ?? emptyCounts();
    counts[g.status] = Number(g.count);
    map.set(g.projectId, counts);
  }
  return map;
}

const progressOf = (c: TaskCounts) => {
  const total = c.TODO + c.IN_PROGRESS + c.IN_REVIEW + c.DONE;
  return total === 0 ? 0 : Math.round((c.DONE / total) * 100);
};

function duplicate(err: unknown): never {
  if (isUniqueViolation(err)) throw new ValidationError({ key: ["Another project already uses this key"] }, "Project key already in use");
  throw err;
}

/** Visibility applied in SQL (visibleProjectWhere): leadership sees all, others only theirs. */
export async function listProjects(ctx: CompanyContext, filter: { teamId?: string; status?: ProjectStatus } = {}): Promise<ProjectListItem[]> {
  const and: WhereOptions[] = [visibleProjectWhere(ctx)];
  if (filter.teamId) and.push({ teamId: filter.teamId });
  if (filter.status) and.push({ status: filter.status });

  const rows = await Project.findAll({
    where: { [Op.and]: and },
    attributes: ["id", "name", "key", "status", "description"],
    include: [
      { model: Team, as: "team", attributes: ["id", "name"] },
      { model: User, as: "projectManager", attributes: ["id", "name"] },
    ],
    order: [["status", "ASC"], ["name", "ASC"]],
  });
  const counts = await taskCountsFor(rows.map(r => r.id));
  return rows.map(r => {
    const c = counts.get(r.id) ?? emptyCounts();
    return {
      id: r.id,
      name: r.name,
      key: r.key,
      status: r.status,
      description: r.description,
      team: { id: r.team!.id, name: r.team!.name },
      projectManager: r.projectManager ? { id: r.projectManager.id, name: r.projectManager.name } : null,
      taskCount: c.TODO + c.IN_PROGRESS + c.IN_REVIEW + c.DONE,
      doneCount: c.DONE,
      progress: progressOf(c),
    };
  });
}

export type ProjectSummary = {
  id: string;
  name: string;
  key: string;
  status: ProjectStatus;
  description: string | null;
  team: { id: string; name: string };
  projectManager: { id: string; name: string; email: string } | null;
  members: { id: string; name: string; email: string }[];
  counts: TaskCounts;
  taskCount: number;
  progress: number;
  updatedAt: string;
};

/** Role-independent part of a project page; safe to cache per project. */
async function loadProjectSummary(projectId: string): Promise<ProjectSummary> {
  const p = await Project.findByPk(projectId, {
    attributes: ["id", "name", "key", "status", "description", "updatedAt"],
    include: [
      { model: Team, as: "team", attributes: ["id", "name"] },
      { model: User, as: "projectManager", attributes: ["id", "name", "email"] },
      { model: ProjectMember, as: "members", attributes: ["createdAt"], include: [{ model: User, as: "user", attributes: ["id", "name", "email"] }] },
    ],
    order: [[{ model: ProjectMember, as: "members" }, "createdAt", "ASC"]],
    rejectOnEmpty: true,
  });
  const counts = (await taskCountsFor([p.id])).get(p.id) ?? emptyCounts();
  return {
    id: p.id,
    name: p.name,
    key: p.key,
    status: p.status,
    description: p.description,
    team: { id: p.team!.id, name: p.team!.name },
    projectManager: p.projectManager ? { id: p.projectManager.id, name: p.projectManager.name, email: p.projectManager.email } : null,
    members: (p.members ?? []).map(m => ({ id: m.user!.id, name: m.user!.name, email: m.user!.email })),
    counts,
    taskCount: counts.TODO + counts.IN_PROGRESS + counts.IN_REVIEW + counts.DONE,
    progress: progressOf(counts),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function getProject(ctx: CompanyContext, projectId: string) {
  const { project, facts } = await authorizeProject(ctx, projectId, "project:read");
  const { value: summary, hit } = await getOrSet(cacheKeys.projectSummary(project.id), cacheTtlSeconds.projectSummary, () => loadProjectSummary(project.id));
  return {
    summary,
    cacheHit: hit,
    permissions: {
      canEdit: can(ctx, "project:update", facts),
      canDelete: can(ctx, "project:delete", facts),
      canAssignPm: can(ctx, "project:assign_pm", facts),
      canManageMembers: can(ctx, "project:manage_members", facts),
      canCreateTask: can(ctx, "task:create", facts),
      canAssignTask: can(ctx, "task:assign", facts),
      canComment: can(ctx, "comment:create", facts),
    },
  };
}

const projectDto = (p: Project) => ({ id: p.id, name: p.name, key: p.key, status: p.status, teamId: p.teamId, projectManagerId: p.projectManagerId });

export async function createProject(ctx: CompanyContext, input: CreateProjectInput) {
  assertCan(ctx, "project:create");
  const team = await loadTeamOrThrow(ctx, input.teamId); // 404 if the team is in another company
  const pm = input.projectManagerId ? await assertCompanyMember(ctx, input.projectManagerId, "Project manager") : null;

  try {
    const project = await sequelize.transaction(async transaction => {
      const created = await Project.create(
        {
          companyId: ctx.company.id,
          teamId: team.id,
          name: input.name,
          key: input.key,
          description: input.description ?? null,
          status: input.status ?? "PLANNED",
          projectManagerId: pm?.id ?? null,
        },
        { transaction },
      );
      // The PM is always a member so visibility rules stay simple.
      if (pm) await ProjectMember.create({ projectId: created.id, userId: pm.id }, { transaction });
      await recordActivity(transaction, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: created.id,
        projectId: created.id, teamId: team.id, action: "PROJECT_CREATED",
        metadata: { name: created.name, key: created.key, team: team.name, projectManagerName: pm?.name ?? null },
      });
      return projectDto(created);
    });
    await invalidate(cacheKeys.dashboard(ctx.company.id));
    return project;
  } catch (err) {
    duplicate(err);
  }
}

export async function updateProject(ctx: CompanyContext, projectId: string, input: UpdateProjectInput) {
  const { project, facts } = await authorizeProject(ctx, projectId, "project:update");

  const changingPm = input.projectManagerId !== undefined && input.projectManagerId !== project.projectManagerId;
  if (changingPm) assertCan(ctx, "project:assign_pm", facts);
  const pm = changingPm && input.projectManagerId ? await assertCompanyMember(ctx, input.projectManagerId, "Project manager") : null;

  const updated = await sequelize.transaction(async transaction => {
    const row = await Project.findByPk(project.id, { transaction, rejectOnEmpty: true });
    if (input.name !== undefined) row.name = input.name;
    if (input.description !== undefined) row.description = input.description;
    if (input.status !== undefined) row.status = input.status;
    if (changingPm) row.projectManagerId = input.projectManagerId ?? null;
    await row.save({ transaction });

    if (pm) await ProjectMember.findOrCreate({ where: { projectId: project.id, userId: pm.id }, transaction });

    const { projectManagerId: _ignored, ...rest } = input;
    void _ignored;
    if (Object.keys(rest).length > 0) {
      await recordActivity(transaction, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: project.id,
        projectId: project.id, teamId: project.teamId, action: "PROJECT_UPDATED",
        metadata: { name: row.name, key: row.key, changed: Object.keys(rest), status: input.status ?? undefined },
      });
    }
    if (changingPm) {
      await recordActivity(transaction, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: project.id,
        projectId: project.id, teamId: project.teamId, action: "PROJECT_MANAGER_CHANGED",
        metadata: { name: row.name, key: row.key, to: pm?.id ?? null, toName: pm?.name ?? null },
      });
    }
    return { id: row.id, name: row.name, key: row.key, status: row.status, projectManagerId: row.projectManagerId };
  });

  await invalidate(cacheKeys.projectSummary(project.id), cacheKeys.dashboard(ctx.company.id));
  void publishProjectEvent(project.id, { type: "PROJECT_UPDATED", actorId: ctx.user.id });
  return updated;
}

export async function deleteProject(ctx: CompanyContext, projectId: string) {
  const { project } = await authorizeProject(ctx, projectId, "project:delete");
  await sequelize.transaction(async transaction => {
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: project.id, teamId: project.teamId,
      action: "PROJECT_DELETED", metadata: { name: project.name, key: project.key },
    });
    await Project.destroy({ where: { id: project.id }, transaction }); // FK cascades remove members, tasks, comments
  });
  await invalidate(cacheKeys.projectSummary(project.id), cacheKeys.dashboard(ctx.company.id));
}

export async function addProjectMember(ctx: CompanyContext, projectId: string, userId: string) {
  const { project } = await authorizeProject(ctx, projectId, "project:manage_members");
  const user = await assertCompanyMember(ctx, userId);
  try {
    await sequelize.transaction(async transaction => {
      await ProjectMember.create({ projectId: project.id, userId: user.id }, { transaction });
      await recordActivity(transaction, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: project.id,
        projectId: project.id, teamId: project.teamId, action: "PROJECT_MEMBER_ADDED",
        metadata: { name: project.name, key: project.key, userId: user.id, userName: user.name },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ValidationError({ userId: ["Already a member"] }, `${user.name} is already on ${project.name}`);
    throw err;
  }
  await invalidate(cacheKeys.projectSummary(project.id));
  void publishProjectEvent(project.id, { type: "PROJECT_UPDATED", actorId: ctx.user.id });
  return user;
}

export async function removeProjectMember(ctx: CompanyContext, projectId: string, userId: string) {
  const { project } = await authorizeProject(ctx, projectId, "project:manage_members");
  if (userId === project.projectManagerId) {
    throw new ValidationError({ userId: ["Is the project manager"] }, "Assign a different project manager before removing this person");
  }
  const membership = await ProjectMember.findOne({
    where: { projectId: project.id, userId },
    attributes: ["id"],
    include: [{ model: User, as: "user", attributes: ["name"] }],
  });
  if (!membership) throw new ValidationError({ userId: ["Not a member"] }, "That person is not on this project");
  await sequelize.transaction(async transaction => {
    await ProjectMember.destroy({ where: { id: membership.id }, transaction });
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: project.id,
      projectId: project.id, teamId: project.teamId, action: "PROJECT_MEMBER_REMOVED",
      metadata: { name: project.name, key: project.key, userId, userName: membership.user?.name },
    });
  });
  await invalidate(cacheKeys.projectSummary(project.id));
  void publishProjectEvent(project.id, { type: "PROJECT_UPDATED", actorId: ctx.user.id });
}

/** Atomically bumps the per-project task counter inside `transaction` and returns the new value. */
export async function nextTaskNumber(projectId: string, transaction: Transaction): Promise<number> {
  const [row] = await sequelize.query<{ taskCounter: number }>(
    `UPDATE "Project" SET "taskCounter" = "taskCounter" + 1, "updatedAt" = NOW() AT TIME ZONE 'UTC' WHERE "id" = :projectId RETURNING "taskCounter"`,
    { replacements: { projectId }, type: QueryTypes.SELECT, transaction },
  );
  return row.taskCounter;
}
