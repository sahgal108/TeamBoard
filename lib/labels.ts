import type { ProjectStatus, TaskPriority, TaskStatus } from "@/lib/db/enums";

export const TASK_STATUS_ORDER: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

/** Tailwind color token per status (see app/globals.css @theme). */
export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "status-todo",
  IN_PROGRESS: "status-progress",
  IN_REVIEW: "status-review",
  DONE: "status-done",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  LOW: "priority-low",
  MEDIUM: "priority-medium",
  HIGH: "priority-high",
  URGENT: "priority-urgent",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};
