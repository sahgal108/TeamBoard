import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import type { Action, Facts } from "@/lib/auth/permissions";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import { assertCan } from "./assert";
import { projectFacts, type LoadedProject } from "./project-access";

export type LoadedTask = {
  id: string;
  companyId: string;
  projectId: string;
  number: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  createdById: string;
  project: LoadedProject;
};

/** Tenant-scoped by the task's own denormalized companyId, and the parent project comes along. */
export async function loadTaskOrThrow(ctx: CompanyContext, taskId: string): Promise<LoadedTask> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: ctx.company.id },
    select: {
      id: true,
      companyId: true,
      projectId: true,
      number: true,
      title: true,
      status: true,
      priority: true,
      assigneeId: true,
      createdById: true,
      project: { select: { id: true, companyId: true, teamId: true, name: true, key: true, status: true, projectManagerId: true } },
    },
  });
  if (!task) throw new NotFoundError("Task");
  return task;
}

export async function taskFacts(ctx: CompanyContext, task: LoadedTask): Promise<Facts> {
  const facts = await projectFacts(ctx, task.project);
  return { ...facts, isAssignee: task.assigneeId === ctx.user.id };
}

/** Steps 3–5 of the pipeline for a task. Invisible task → 404 for every action (see project-access). */
export async function authorizeTask(ctx: CompanyContext, taskId: string, action: Action) {
  const task = await loadTaskOrThrow(ctx, taskId);
  const facts = await taskFacts(ctx, task);
  assertCan(ctx, "task:read", facts);
  if (action !== "task:read") assertCan(ctx, action, facts);
  return { task, facts };
}
