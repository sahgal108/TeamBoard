import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { can } from "@/lib/auth/permissions";
import { assertCompanyMember } from "@/lib/authorization/company-users";
import { authorizeProject } from "@/lib/authorization/project-access";
import { authorizeTask } from "@/lib/authorization/task-access";
import { visibleTaskWhere } from "@/lib/authorization/visibility";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, InvalidTransitionError } from "@/lib/errors";
import { publishProjectEvent } from "@/lib/realtime/publish";
import { invalidate } from "@/lib/redis/cache";
import { cacheKeys } from "@/lib/redis/keys";
import { TRANSITIONS, canTransition } from "@/lib/task-transitions";
import type { CreateCommentInput, CreateTaskInput, TaskListQuery, UpdateTaskInput } from "@/validations/task.schema";
import { listEntityActivity, recordActivity } from "./activity.service";

// Status state machine lives in lib/task-transitions.ts so the board can explain an
// impossible drop before making a request; the service remains the authority (400 INVALID_TRANSITION).
export { TRANSITIONS, canTransition };

export type TaskListItem = {
  id: string;
  key: string;
  number: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  updatedAt: string;
  project: { id: string; name: string; key: string };
  assignee: { id: string; name: string } | null;
  commentCount: number;
};

const listSelect = {
  id: true, number: true, title: true, status: true, priority: true, dueDate: true, updatedAt: true,
  project: { select: { id: true, name: true, key: true } },
  assignee: { select: { id: true, name: true } },
  _count: { select: { comments: true } },
} as const;

type ListRow = {
  id: string; number: number; title: string; status: TaskStatus; priority: TaskPriority; dueDate: Date | null; updatedAt: Date;
  project: { id: string; name: string; key: string }; assignee: { id: string; name: string } | null; _count: { comments: number };
};

const toListItem = (t: ListRow): TaskListItem => ({
  id: t.id,
  key: `${t.project.key}-${t.number}`,
  number: t.number,
  title: t.title,
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate?.toISOString() ?? null,
  updatedAt: t.updatedAt.toISOString(),
  project: t.project,
  assignee: t.assignee,
  commentCount: t._count.comments,
});

const cacheKeysFor = (companyId: string, projectId: string) => [cacheKeys.dashboard(companyId), cacheKeys.projectSummary(projectId)];

/** Visibility in SQL; filters narrow further. */
export async function listTasks(ctx: CompanyContext, q: TaskListQuery = {}): Promise<TaskListItem[]> {
  const rows = await prisma.task.findMany({
    where: {
      AND: [
        visibleTaskWhere(ctx),
        q.projectId ? { projectId: q.projectId } : {},
        q.status ? { status: q.status } : {},
        q.assigneeId ? { assigneeId: q.assigneeId } : {},
        q.mine ? { assigneeId: ctx.user.id } : {},
      ],
    },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { number: "asc" }],
    select: listSelect,
  });
  return rows.map(toListItem);
}

export async function getTask(ctx: CompanyContext, taskId: string) {
  const { task, facts } = await authorizeTask(ctx, taskId, "task:read");
  const [row, activity] = await Promise.all([
    prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      select: {
        ...listSelect,
        description: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, content: true, createdAt: true, user: { select: { id: true, name: true } } },
        },
      },
    }),
    listEntityActivity(ctx, "TASK", task.id),
  ]);

  const manages = can(ctx, "task:assign", facts);
  return {
    ...toListItem(row),
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    assignee: row.assignee,
    comments: row.comments.map(c => ({ id: c.id, content: c.content, createdAt: c.createdAt.toISOString(), author: c.user })),
    activity,
    allowedTransitions: TRANSITIONS[row.status],
    permissions: {
      canChangeStatus: can(ctx, "task:update_status", facts),
      canEdit: can(ctx, "task:edit", facts),
      /** title and priority need project-level rights; an assignee may only edit description and due date */
      canEditAll: manages,
      canAssign: manages,
      canDelete: can(ctx, "task:delete", facts),
      canComment: can(ctx, "comment:create", facts),
    },
  };
}

export async function createTask(ctx: CompanyContext, input: CreateTaskInput) {
  const { project } = await authorizeProject(ctx, input.projectId, "task:create");
  const assignee = input.assigneeId ? await assertCompanyMember(ctx, input.assigneeId, "Assignee") : null;

  const task = await prisma.$transaction(async tx => {
    // Atomic per-project sequence: the increment returns the new counter value.
    const { taskCounter } = await tx.project.update({
      where: { id: project.id },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true },
    });
    const created = await tx.task.create({
      data: {
        companyId: project.companyId, // copied from the parent, never from input
        projectId: project.id,
        number: taskCounter,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "MEDIUM",
        assigneeId: assignee?.id ?? null,
        createdById: ctx.user.id,
        dueDate: input.dueDate ?? null,
      },
      select: listSelect,
    });
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: created.id,
      projectId: project.id, teamId: project.teamId, action: "TASK_CREATED",
      metadata: { title: created.title, key: `${project.key}-${created.number}`, assigneeName: assignee?.name ?? null },
    });
    return created;
  });

  await invalidate(...cacheKeysFor(ctx.company.id, project.id));
  void publishProjectEvent(project.id, { type: "TASK_CREATED", taskId: task.id, actorId: ctx.user.id });
  return toListItem(task);
}

export async function updateTask(ctx: CompanyContext, taskId: string, input: UpdateTaskInput) {
  const { task, facts } = await authorizeTask(ctx, taskId, "task:edit");

  // An assignee without project rights may change description and due date only.
  const touchesProtected = input.title !== undefined || input.priority !== undefined;
  if (touchesProtected && !can(ctx, "task:assign", facts)) {
    throw new ForbiddenError("Only the project manager, the team lead or company leadership can change the title or priority");
  }

  const updated = await prisma.$transaction(async tx => {
    const row = await tx.task.update({
      where: { id: task.id },
      data: { title: input.title, description: input.description, priority: input.priority, dueDate: input.dueDate },
      select: listSelect,
    });
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "TASK_UPDATED",
      metadata: { title: row.title, key: `${task.project.key}-${task.number}`, changed: Object.keys(input) },
    });
    return row;
  });

  await invalidate(...cacheKeysFor(ctx.company.id, task.projectId));
  void publishProjectEvent(task.projectId, { type: "TASK_UPDATED", taskId: task.id, actorId: ctx.user.id });
  return toListItem(updated);
}

export async function changeTaskStatus(ctx: CompanyContext, taskId: string, to: TaskStatus) {
  const { task } = await authorizeTask(ctx, taskId, "task:update_status");
  if (task.status === to) return toListItem(await prisma.task.findUniqueOrThrow({ where: { id: task.id }, select: listSelect }));
  if (!canTransition(task.status, to)) throw new InvalidTransitionError(task.status, to);

  const updated = await prisma.$transaction(async tx => {
    const row = await tx.task.update({ where: { id: task.id }, data: { status: to }, select: listSelect });
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "TASK_STATUS_CHANGED",
      metadata: { title: task.title, key: `${task.project.key}-${task.number}`, from: task.status, to },
    });
    return row;
  });

  await invalidate(...cacheKeysFor(ctx.company.id, task.projectId));
  void publishProjectEvent(task.projectId, { type: "TASK_STATUS_CHANGED", taskId: task.id, from: task.status, to, actorId: ctx.user.id });
  return toListItem(updated);
}

export async function assignTask(ctx: CompanyContext, taskId: string, assigneeId: string | null) {
  const { task } = await authorizeTask(ctx, taskId, "task:assign");
  const assignee = assigneeId ? await assertCompanyMember(ctx, assigneeId, "Assignee") : null;

  const updated = await prisma.$transaction(async tx => {
    const row = await tx.task.update({ where: { id: task.id }, data: { assigneeId: assignee?.id ?? null }, select: listSelect });
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "TASK_ASSIGNED",
      metadata: { title: task.title, key: `${task.project.key}-${task.number}`, to: assignee?.id ?? null, toName: assignee?.name ?? null },
    });
    return row;
  });

  await invalidate(...cacheKeysFor(ctx.company.id, task.projectId));
  void publishProjectEvent(task.projectId, { type: "TASK_ASSIGNED", taskId: task.id, assigneeId: assignee?.id ?? null, actorId: ctx.user.id });
  return toListItem(updated);
}

export async function deleteTask(ctx: CompanyContext, taskId: string) {
  const { task } = await authorizeTask(ctx, taskId, "task:delete");
  await prisma.$transaction(async tx => {
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "TASK_DELETED",
      metadata: { title: task.title, key: `${task.project.key}-${task.number}` },
    });
    await tx.task.delete({ where: { id: task.id } });
  });
  await invalidate(...cacheKeysFor(ctx.company.id, task.projectId));
  void publishProjectEvent(task.projectId, { type: "TASK_DELETED", taskId: task.id, actorId: ctx.user.id });
}

export async function listComments(ctx: CompanyContext, taskId: string) {
  const { task } = await authorizeTask(ctx, taskId, "task:read");
  const rows = await prisma.comment.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, content: true, createdAt: true, user: { select: { id: true, name: true } } },
  });
  return rows.map(c => ({ id: c.id, content: c.content, createdAt: c.createdAt.toISOString(), author: c.user }));
}

export async function addComment(ctx: CompanyContext, taskId: string, input: CreateCommentInput) {
  const { task } = await authorizeTask(ctx, taskId, "comment:create");
  const comment = await prisma.$transaction(async tx => {
    const created = await tx.comment.create({
      data: { companyId: task.companyId, taskId: task.id, userId: ctx.user.id, content: input.content },
      select: { id: true, content: true, createdAt: true, user: { select: { id: true, name: true } } },
    });
    await recordActivity(tx, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "COMMENT_ADDED",
      metadata: { title: task.title, key: `${task.project.key}-${task.number}`, commentId: created.id },
    });
    return created;
  });
  void publishProjectEvent(task.projectId, { type: "COMMENT_ADDED", taskId: task.id, commentId: comment.id, actorId: ctx.user.id });
  return { id: comment.id, content: comment.content, createdAt: comment.createdAt.toISOString(), author: comment.user };
}
