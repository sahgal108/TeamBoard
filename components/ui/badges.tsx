"use client";

import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { Badge, Tag } from "antd";
import type { ProjectStatus, TaskPriority, TaskStatus } from "@/lib/db/enums";
import { color } from "@/lib/design-system";
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";

// antd preset tag colors per status; the dot colors match the board columns.
const TASK_STATUS_TAG: Record<TaskStatus, string> = { TODO: "default", IN_PROGRESS: "processing", IN_REVIEW: "warning", DONE: "success" };
export const TASK_STATUS_HEX: Record<TaskStatus, string> = color.taskStatus;

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return (
    <Tag color={TASK_STATUS_TAG[status]} variant="filled">
      {TASK_STATUS_LABEL[status]}
    </Tag>
  );
}

export function StatusDot({ status }: { status: TaskStatus }) {
  return <Badge color={TASK_STATUS_HEX[status]} />;
}

const PROJECT_STATUS_TAG: Record<ProjectStatus, string> = { ACTIVE: "success", PLANNED: "default", COMPLETED: "processing", ARCHIVED: "default" };

export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  return (
    <Tag color={PROJECT_STATUS_TAG[status]} variant="filled">
      {PROJECT_STATUS_LABEL[status]}
    </Tag>
  );
}

const PRIORITY_TAG: Record<TaskPriority, string> = { LOW: "default", MEDIUM: "blue", HIGH: "orange", URGENT: "red" };

export function PriorityTag({ priority }: { priority: TaskPriority }) {
  return (
    <Tag color={PRIORITY_TAG[priority]} variant="outlined" icon={priority === "LOW" ? <ArrowDownOutlined /> : <ArrowUpOutlined />}>
      {PRIORITY_LABEL[priority]}
    </Tag>
  );
}

export function KeyTag({ children }: { children: string }) {
  return <span className="font-mono text-xs text-ink-3">{children}</span>;
}
