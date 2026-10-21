import type { ProjectStatus, TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";

const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  TODO: "text-status-todo bg-[#eef2f6]",
  IN_PROGRESS: "text-status-progress bg-[#e4edff]",
  IN_REVIEW: "text-status-review bg-[#fdf1df]",
  DONE: "text-status-done bg-accent-soft",
};
const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  TODO: "bg-status-todo",
  IN_PROGRESS: "bg-status-progress",
  IN_REVIEW: "bg-status-review",
  DONE: "bg-status-done",
};

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium ${TASK_STATUS_STYLE[status]}`}>
      <i className={`size-1.5 rounded-full ${TASK_STATUS_DOT[status]}`} />
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}

export function StatusDot({ status }: { status: TaskStatus }) {
  return <i className={`inline-block size-2 rounded-full ${TASK_STATUS_DOT[status]}`} />;
}

const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  ACTIVE: "text-status-done bg-accent-soft",
  PLANNED: "text-status-todo bg-[#eef2f6]",
  COMPLETED: "text-status-progress bg-[#e4edff]",
  ARCHIVED: "text-ink-3 bg-line-2",
};
const PROJECT_STATUS_DOT: Record<ProjectStatus, string> = {
  ACTIVE: "bg-status-done",
  PLANNED: "bg-status-todo",
  COMPLETED: "bg-status-progress",
  ARCHIVED: "bg-ink-3",
};

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium ${PROJECT_STATUS_STYLE[status]}`}>
      <i className={`size-1.5 rounded-full ${PROJECT_STATUS_DOT[status]}`} />
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  LOW: "text-priority-low",
  MEDIUM: "text-priority-medium",
  HIGH: "text-priority-high",
  URGENT: "text-priority-urgent",
};

export function PriorityTag({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11.5px] font-medium ${PRIORITY_STYLE[priority]}`}>
      <svg width="8" height="7" viewBox="0 0 8 7" aria-hidden="true" className={priority === "LOW" ? "rotate-180" : ""}>
        <path d="M4 0 8 7H0z" fill="currentColor" />
      </svg>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function KeyTag({ children }: { children: string }) {
  return <span className="font-mono text-[11.5px] text-ink-3">{children}</span>;
}
