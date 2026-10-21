import { z } from "zod";
import { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { idSchema, nullableDate } from "./common";

export const taskStatusSchema = z.enum(Object.values(TaskStatus) as [TaskStatus, ...TaskStatus[]]);
export const taskPrioritySchema = z.enum(Object.values(TaskPriority) as [TaskPriority, ...TaskPriority[]]);

export const createTaskSchema = z.object({
  projectId: idSchema,
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(4000).optional().nullable(),
  priority: taskPrioritySchema.optional(),
  assigneeId: idSchema.optional().nullable(),
  dueDate: nullableDate.optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    description: z.string().trim().max(4000).nullable(),
    priority: taskPrioritySchema,
    dueDate: nullableDate,
  })
  .partial()
  .refine(v => Object.keys(v).length > 0, { message: "Nothing to update" });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskStatusChangeSchema = z.object({ status: taskStatusSchema });
export const taskAssigneeSchema = z.object({ assigneeId: idSchema.nullable() });

export const taskListQuerySchema = z.object({
  projectId: idSchema.optional(),
  status: taskStatusSchema.optional(),
  assigneeId: idSchema.optional(),
  /** "1" → only tasks assigned to the caller */
  mine: z.enum(["1", "true"]).optional(),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
