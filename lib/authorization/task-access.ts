import type { Action, Facts } from "@/lib/auth/permissions";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import type { TaskPriority, TaskStatus } from "@/lib/db/enums";
import { Project, Task } from "@/lib/db/models";
import { NotFoundError } from "@/lib/errors";
import { assertCan } from "./assert";
import { PROJECT_ATTRIBUTES, projectFacts, toLoadedProject, type LoadedProject } from "./project-access";

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
  const task = await Task.findOne({
    where: { id: taskId, companyId: ctx.company.id },
    attributes: ["id", "companyId", "projectId", "number", "title", "status", "priority", "assigneeId", "createdById"],
    include: [{ model: Project, as: "project", attributes: [...PROJECT_ATTRIBUTES] }],
  });
  if (!task?.project) throw new NotFoundError("Task");
  return {
    id: task.id,
    companyId: task.companyId,
    projectId: task.projectId,
    number: task.number,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    createdById: task.createdById,
    project: toLoadedProject(task.project),
  };
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
