import { Op, literal, type FindAttributeOptions, type Includeable, type Transaction, type WhereOptions } from "sequelize";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { aiEnabled } from "@/lib/ai/provider";
import { can } from "@/lib/auth/permissions";
import { assertCompanyMember } from "@/lib/authorization/company-users";
import { authorizeProject } from "@/lib/authorization/project-access";
import { authorizeTask } from "@/lib/authorization/task-access";
import { visibleTaskWhere } from "@/lib/authorization/visibility";
import type { TaskPriority, TaskStatus } from "@/lib/db/enums";
import { Comment, Project, Task, User, sequelize } from "@/lib/db/models";
import { ForbiddenError, InvalidTransitionError, ValidationError } from "@/lib/errors";
import { publishProjectEvent } from "@/lib/realtime/publish";
import { invalidate } from "@/lib/redis/cache";
import { cacheKeys } from "@/lib/redis/keys";
import { TRANSITIONS, canTransition } from "@/lib/task-transitions";
import type { CreateCommentInput, CreateSubtasksInput, CreateTaskInput, TaskListQuery, UpdateTaskInput } from "@/validations/task.schema";
import { listEntityActivity, recordActivity } from "./activity.service";
import { nextTaskNumber } from "./project.service";

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

const LIST_ATTRIBUTES: FindAttributeOptions = [
  "id", "number", "title", "status", "priority", "dueDate", "updatedAt",
  [literal(`(SELECT COUNT(*) FROM "Comment" c WHERE c."taskId" = "Task"."id")`), "commentCount"],
];
const listInclude = (): Includeable[] => [
  { model: Project, as: "project", attributes: ["id", "name", "key"] },
  { model: User, as: "assignee", attributes: ["id", "name"] },
];

const toListItem = (t: Task): TaskListItem => ({
  id: t.id,
  key: `${t.project!.key}-${t.number}`,
  number: t.number,
  title: t.title,
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate?.toISOString() ?? null,
  updatedAt: t.updatedAt.toISOString(),
  project: { id: t.project!.id, name: t.project!.name, key: t.project!.key },
  assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
  commentCount: Number(t.get("commentCount") ?? 0),
});

/** Reloads one task in list shape, optionally inside a transaction. */
async function loadListItem(taskId: string, transaction?: Transaction): Promise<TaskListItem> {
  const row = await Task.findByPk(taskId, { attributes: LIST_ATTRIBUTES, include: listInclude(), transaction, rejectOnEmpty: true });
  return toListItem(row);
}

const cacheKeysFor = (companyId: string, projectId: string) => [cacheKeys.dashboard(companyId), cacheKeys.projectSummary(projectId)];

/** Visibility in SQL; filters narrow further. */
export async function listTasks(ctx: CompanyContext, q: TaskListQuery = {}): Promise<TaskListItem[]> {
  const and: WhereOptions[] = [visibleTaskWhere(ctx)];
  if (q.projectId) and.push({ projectId: q.projectId });
  if (q.status) and.push({ status: q.status });
  if (q.assigneeId) and.push({ assigneeId: q.assigneeId });
  if (q.mine) and.push({ assigneeId: ctx.user.id });

  const rows = await Task.findAll({
    where: { [Op.and]: and },
    attributes: LIST_ATTRIBUTES,
    include: listInclude(),
    order: [["status", "ASC"], ["priority", "DESC"], ["dueDate", "ASC"], ["number", "ASC"]],
  });
  return rows.map(toListItem);
}

export async function getTask(ctx: CompanyContext, taskId: string) {
  const { task, facts } = await authorizeTask(ctx, taskId, "task:read");
  const [row, activity, parent, subtasks] = await Promise.all([
    Task.findByPk(task.id, {
      attributes: [...(LIST_ATTRIBUTES as unknown[]), "description", "createdAt"] as FindAttributeOptions,
      include: [
        { model: Project, as: "project", attributes: ["id", "name", "key"] },
        { model: User, as: "assignee", attributes: ["id", "name", "email"] },
        { model: User, as: "createdBy", attributes: ["id", "name"] },
        { model: Comment, as: "comments", attributes: ["id", "content", "createdAt"], include: [{ model: User, as: "user", attributes: ["id", "name"] }] },
      ],
      order: [[{ model: Comment, as: "comments" }, "createdAt", "ASC"]],
      rejectOnEmpty: true,
    }),
    listEntityActivity(ctx, "TASK", task.id),
    // Separate queries: a second hasMany include would multiply rows with the comments join.
    task.parentId ? Task.findOne({ where: { id: task.parentId, companyId: ctx.company.id }, attributes: ["id", "number", "title"] }) : null,
    Task.findAll({
      where: { parentId: task.id, companyId: ctx.company.id },
      attributes: ["id", "number", "title", "status"],
      include: [{ model: User, as: "assignee", attributes: ["id", "name"] }],
      order: [["number", "ASC"]],
    }),
  ]);

  const manages = can(ctx, "task:assign", facts);
  const key = (n: number) => `${task.project.key}-${n}`;
  const topLevel = !task.parentId;
  return {
    ...toListItem(row),
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    createdBy: { id: row.createdBy!.id, name: row.createdBy!.name },
    assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name, email: row.assignee.email } : null,
    comments: (row.comments ?? []).map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      author: { id: c.user!.id, name: c.user!.name },
    })),
    activity,
    parent: parent ? { id: parent.id, key: key(parent.number), title: parent.title } : null,
    subtasks: subtasks.map(s => ({ id: s.id, key: key(s.number), title: s.title, status: s.status, assignee: s.assignee ? { id: s.assignee.id, name: s.assignee.name } : null })),
    allowedTransitions: TRANSITIONS[row.status as TaskStatus],
    permissions: {
      canChangeStatus: can(ctx, "task:update_status", facts),
      canEdit: can(ctx, "task:edit", facts),
      /** title and priority need project-level rights; an assignee may only edit description and due date */
      canEditAll: manages,
      canAssign: manages,
      canDelete: can(ctx, "task:delete", facts),
      canComment: can(ctx, "comment:create", facts),
      /** Subtasks are one level deep, so only a top-level task can get them. */
      canAddSubtasks: topLevel && can(ctx, "task:create", facts),
      canBreakDown: topLevel && aiEnabled() && can(ctx, "ai:breakdown", facts),
    },
  };
}

export async function createTask(ctx: CompanyContext, input: CreateTaskInput) {
  const { project } = await authorizeProject(ctx, input.projectId, "task:create");
  const assignee = input.assigneeId ? await assertCompanyMember(ctx, input.assigneeId, "Assignee") : null;

  const task = await sequelize.transaction(async transaction => {
    // Atomic per-project sequence: the increment returns the new counter value.
    const number = await nextTaskNumber(project.id, transaction);
    const created = await Task.create(
      {
        companyId: project.companyId, // copied from the parent, never from input
        projectId: project.id,
        number,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "MEDIUM",
        assigneeId: assignee?.id ?? null,
        createdById: ctx.user.id,
        dueDate: input.dueDate ?? null,
      },
      { transaction },
    );
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: created.id,
      projectId: project.id, teamId: project.teamId, action: "TASK_CREATED",
      metadata: { title: created.title, key: `${project.key}-${created.number}`, assigneeName: assignee?.name ?? null },
    });
    return loadListItem(created.id, transaction);
  });

  await invalidate(...cacheKeysFor(ctx.company.id, project.id));
  void publishProjectEvent(project.id, { type: "TASK_CREATED", taskId: task.id, actorId: ctx.user.id });
  return task;
}

/** Applies the given column changes and returns the task in list shape, all inside `transaction`. */
async function updateColumns(taskId: string, changes: Partial<Pick<Task, "title" | "description" | "priority" | "dueDate" | "status" | "assigneeId">>, transaction: Transaction) {
  const row = await Task.findByPk(taskId, { transaction, rejectOnEmpty: true });
  for (const [k, v] of Object.entries(changes)) {
    if (v !== undefined) row.set(k as keyof typeof changes, v as never);
  }
  await row.save({ transaction });
  return loadListItem(taskId, transaction);
}

export async function updateTask(ctx: CompanyContext, taskId: string, input: UpdateTaskInput) {
  const { task, facts } = await authorizeTask(ctx, taskId, "task:edit");

  // An assignee without project rights may change description and due date only.
  const touchesProtected = input.title !== undefined || input.priority !== undefined;
  if (touchesProtected && !can(ctx, "task:assign", facts)) {
    throw new ForbiddenError("Only the project manager, the team lead or company leadership can change the title or priority");
  }

  const updated = await sequelize.transaction(async transaction => {
    const row = await updateColumns(task.id, { title: input.title, description: input.description, priority: input.priority, dueDate: input.dueDate }, transaction);
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "TASK_UPDATED",
      metadata: { title: row.title, key: `${task.project.key}-${task.number}`, changed: Object.keys(input) },
    });
    return row;
  });

  await invalidate(...cacheKeysFor(ctx.company.id, task.projectId));
  void publishProjectEvent(task.projectId, { type: "TASK_UPDATED", taskId: task.id, actorId: ctx.user.id });
  return updated;
}

export async function changeTaskStatus(ctx: CompanyContext, taskId: string, to: TaskStatus) {
  const { task } = await authorizeTask(ctx, taskId, "task:update_status");
  if (task.status === to) return loadListItem(task.id);
  if (!canTransition(task.status, to)) throw new InvalidTransitionError(task.status, to);

  const updated = await sequelize.transaction(async transaction => {
    const row = await updateColumns(task.id, { status: to }, transaction);
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "TASK_STATUS_CHANGED",
      metadata: { title: task.title, key: `${task.project.key}-${task.number}`, from: task.status, to },
    });
    return row;
  });

  await invalidate(...cacheKeysFor(ctx.company.id, task.projectId));
  void publishProjectEvent(task.projectId, { type: "TASK_STATUS_CHANGED", taskId: task.id, from: task.status, to, actorId: ctx.user.id });
  return updated;
}

export async function assignTask(ctx: CompanyContext, taskId: string, assigneeId: string | null) {
  const { task } = await authorizeTask(ctx, taskId, "task:assign");
  const assignee = assigneeId ? await assertCompanyMember(ctx, assigneeId, "Assignee") : null;

  const updated = await sequelize.transaction(async transaction => {
    const row = await Task.findByPk(task.id, { transaction, rejectOnEmpty: true });
    row.assigneeId = assignee?.id ?? null;
    await row.save({ transaction });
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "TASK_ASSIGNED",
      metadata: { title: task.title, key: `${task.project.key}-${task.number}`, to: assignee?.id ?? null, toName: assignee?.name ?? null },
    });
    return loadListItem(task.id, transaction);
  });

  await invalidate(...cacheKeysFor(ctx.company.id, task.projectId));
  void publishProjectEvent(task.projectId, { type: "TASK_ASSIGNED", taskId: task.id, assigneeId: assignee?.id ?? null, actorId: ctx.user.id });
  return updated;
}

/**
 * Creates several subtasks under one top-level task, all or none: one transaction, each with
 * its own number and TASK_CREATED activity. Same rights as creating a task in the project.
 */
export async function createSubtasks(ctx: CompanyContext, parentId: string, input: CreateSubtasksInput) {
  const { task: parent } = await authorizeTask(ctx, parentId, "task:create");
  if (parent.parentId) throw new ValidationError(undefined, "Subtasks can only be added to a top-level task");
  const parentKey = `${parent.project.key}-${parent.number}`;

  const created = await sequelize.transaction(async transaction => {
    const items: TaskListItem[] = [];
    for (const draft of input.subtasks) {
      const number = await nextTaskNumber(parent.projectId, transaction);
      const row = await Task.create(
        {
          companyId: parent.companyId,
          projectId: parent.projectId,
          parentId: parent.id,
          number,
          title: draft.title,
          description: draft.description ?? null,
          priority: draft.priority ?? "MEDIUM",
          createdById: ctx.user.id,
        },
        { transaction },
      );
      await recordActivity(transaction, {
        companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: row.id,
        projectId: parent.projectId, teamId: parent.project.teamId, action: "TASK_CREATED",
        metadata: { title: row.title, key: `${parent.project.key}-${number}`, parentKey, aiAssisted: input.aiAssisted || undefined },
      });
      items.push(await loadListItem(row.id, transaction));
    }
    return items;
  });

  await invalidate(...cacheKeysFor(ctx.company.id, parent.projectId));
  for (const t of created) void publishProjectEvent(parent.projectId, { type: "TASK_CREATED", taskId: t.id, actorId: ctx.user.id });
  return created;
}

export async function deleteTask(ctx: CompanyContext, taskId: string) {
  const { task } = await authorizeTask(ctx, taskId, "task:delete");
  await sequelize.transaction(async transaction => {
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "TASK_DELETED",
      metadata: { title: task.title, key: `${task.project.key}-${task.number}` },
    });
    await Task.destroy({ where: { id: task.id }, transaction });
  });
  await invalidate(...cacheKeysFor(ctx.company.id, task.projectId));
  void publishProjectEvent(task.projectId, { type: "TASK_DELETED", taskId: task.id, actorId: ctx.user.id });
}

const commentInclude = (): Includeable[] => [{ model: User, as: "user", attributes: ["id", "name"] }];
const toCommentDto = (c: Comment) => ({ id: c.id, content: c.content, createdAt: c.createdAt.toISOString(), author: { id: c.user!.id, name: c.user!.name } });

export async function listComments(ctx: CompanyContext, taskId: string) {
  const { task } = await authorizeTask(ctx, taskId, "task:read");
  const rows = await Comment.findAll({
    where: { taskId: task.id },
    attributes: ["id", "content", "createdAt"],
    include: commentInclude(),
    order: [["createdAt", "ASC"]],
  });
  return rows.map(toCommentDto);
}

export async function addComment(ctx: CompanyContext, taskId: string, input: CreateCommentInput) {
  const { task } = await authorizeTask(ctx, taskId, "comment:create");
  const comment = await sequelize.transaction(async transaction => {
    const created = await Comment.create({ companyId: task.companyId, taskId: task.id, userId: ctx.user.id, content: input.content }, { transaction });
    await recordActivity(transaction, {
      companyId: ctx.company.id, userId: ctx.user.id, entityType: "TASK", entityId: task.id,
      projectId: task.projectId, teamId: task.project.teamId, action: "COMMENT_ADDED",
      metadata: { title: task.title, key: `${task.project.key}-${task.number}`, commentId: created.id },
    });
    return Comment.findByPk(created.id, { attributes: ["id", "content", "createdAt"], include: commentInclude(), transaction, rejectOnEmpty: true });
  });
  void publishProjectEvent(task.projectId, { type: "COMMENT_ADDED", taskId: task.id, commentId: comment.id, actorId: ctx.user.id });
  return toCommentDto(comment);
}
