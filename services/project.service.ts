import type { ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { can } from "@/lib/auth/permissions";
import { assertCan } from "@/lib/authorization/assert";
import { assertCompanyMember } from "@/lib/authorization/company-users";
import { authorizeProject } from "@/lib/authorization/project-access";
import { loadTeamOrThrow } from "@/lib/authorization/team-access";
import { visibleProjectWhere } from "@/lib/authorization/visibility";
import { prisma } from "@/lib/db/prisma";
import { isUniqueViolation } from "@/lib/db/prisma-errors";
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
  const grouped = await prisma.task.groupBy({
    by: ["projectId", "status"],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });
  for (const g of grouped) {
    const counts = map.get(g.projectId) ?? emptyCounts();
    counts[g.status] = g._count._all;
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
  const rows = await prisma.project.findMany({
    where: { AND: [visibleProjectWhere(ctx), filter.teamId ? { teamId: filter.teamId } : {}, filter.status ? { status: filter.status } : {}] },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, key: true, status: true, description: true,
      team: { select: { id: true, name: true } },
      projectManager: { select: { id: true, name: true } },
    },
  });
  const counts = await taskCountsFor(rows.map(r => r.id));
  return rows.map(r => {
    const c = counts.get(r.id) ?? emptyCounts();
    return { ...r, taskCount: c.TODO + c.IN_PROGRESS + c.IN_REVIEW + c.DONE, doneCount: c.DONE, progress: progressOf(c) };
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
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true, name: true, key: true, status: true, description: true, updatedAt: true,
      team: { select: { id: true, name: true } },
      projectManager: { select: { id: true, name: true, email: true } },
      members: { orderBy: { createdAt: "asc" }, select: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  const counts = (await taskCountsFor([p.id])).get(p.id) ?? emptyCounts();
  return {
    id: p.id, name: p.name, key: p.key, status: p.status, description: p.description,
    team: p.team, projectManager: p.projectManager,
    members: p.members.map(m => m.user),
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

export async function createProject(ctx: CompanyContext, input: CreateProjectInput) {
  assertCan(ctx, "project:create");
  const team = await loadTeamOrThrow(ctx, input.teamId); // 404 if the team is in another company
  const pm = input.projectManagerId ? await assertCompanyMember(ctx, input.projectManagerId, "Project manager") : null;

  try {
    const project = await prisma.$transaction(async tx => {
      const created = await tx.project.create({
        data: {
          companyId: ctx.company.id,
          teamId: team.id,
          name: input.name,
          key: input.key,
          description: input.description ?? null,
          status: input.status ?? "PLANNED",
          projectManagerId: pm?.id ?? null,
          // The PM is always a member so visibility rules stay simple.
          members: pm ? { create: { userId: pm.id } } : undefined,
        },
        select: { id: true, name: true, key: true, status: true, teamId: true, projectManagerId: true },
      });
      await recordActivity(tx, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: created.id,
        projectId: created.id, teamId: team.id, action: "PROJECT_CREATED",
        metadata: { name: created.name, key: created.key, team: team.name, projectManagerName: pm?.name ?? null },
      });
      return created;
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

  const updated = await prisma.$transaction(async tx => {
    const row = await tx.project.update({
      where: { id: project.id },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        projectManagerId: changingPm ? (input.projectManagerId ?? null) : undefined,
      },
      select: { id: true, name: true, key: true, status: true, projectManagerId: true },
    });
    if (pm) {
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: pm.id } },
        create: { projectId: project.id, userId: pm.id },
        update: {},
      });
    }
    const { projectManagerId: _ignored, ...rest } = input;
    void _ignored;
    if (Object.keys(rest).length > 0) {
      await recordActivity(tx, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: project.id,
        projectId: project.id, teamId: project.teamId, action: "PROJECT_UPDATED",
        metadata: { name: row.name, key: row.key, changed: Object.keys(rest), status: input.status ?? undefined },
      });
    }
    if (changingPm) {
      await recordActivity(tx, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: project.id,
        projectId: project.id, teamId: project.teamId, action: "PROJECT_MANAGER_CHANGED",
        metadata: { name: row.name, key: row.key, to: pm?.id ?? null, toName: pm?.name ?? null },
      });
    }
    return row;
  });

  await invalidate(cacheKeys.projectSummary(project.id), cacheKeys.dashboard(ctx.company.id));
  void publishProjectEvent(project.id, { type: "PROJECT_UPDATED", actorId: ctx.user.id });
  return updated;
}

export async function deleteProject(ctx: CompanyContext, projectId: string) {
  const { project } = await authorizeProject(ctx, projectId, "project:delete");
  await prisma.$transaction(async tx => {
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: project.id, teamId: project.teamId,
      action: "PROJECT_DELETED", metadata: { name: project.name, key: project.key },
    });
    await tx.project.delete({ where: { id: project.id } }); // cascades members, tasks, comments
  });
  await invalidate(cacheKeys.projectSummary(project.id), cacheKeys.dashboard(ctx.company.id));
}

export async function addProjectMember(ctx: CompanyContext, projectId: string, userId: string) {
  const { project } = await authorizeProject(ctx, projectId, "project:manage_members");
  const user = await assertCompanyMember(ctx, userId);
  try {
    await prisma.$transaction(async tx => {
      await tx.projectMember.create({ data: { projectId: project.id, userId: user.id } });
      await recordActivity(tx, {
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
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId } },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!membership) throw new ValidationError({ userId: ["Not a member"] }, "That person is not on this project");
  await prisma.$transaction(async tx => {
    await tx.projectMember.delete({ where: { id: membership.id } });
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "PROJECT", entityId: project.id,
      projectId: project.id, teamId: project.teamId, action: "PROJECT_MEMBER_REMOVED",
      metadata: { name: project.name, key: project.key, userId, userName: membership.user.name },
    });
  });
  await invalidate(cacheKeys.projectSummary(project.id));
  void publishProjectEvent(project.id, { type: "PROJECT_UPDATED", actorId: ctx.user.id });
}
