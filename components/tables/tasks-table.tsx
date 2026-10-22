"use client";

import { Table, Typography } from "antd";
import Link from "next/link";
import { PersonCell } from "@/components/ui/avatar";
import { KeyTag, PriorityTag, TaskStatusPill } from "@/components/ui/badges";
import { dueColor, dueLabel } from "@/lib/format";
import { TASK_STATUS_ORDER } from "@/lib/labels";
import type { TaskListItem } from "@/services/task.service";

const PRIORITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 } as const;

export function TasksTable({ rows }: { rows: TaskListItem[] }) {
  return (
    <Table<TaskListItem>
      rowKey="id"
      dataSource={rows}
      pagination={rows.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: "No tasks match." }}
      columns={[
        {
          title: "Task",
          key: "task",
          render: (_, t) => (
            <div>
              <Link href={`/tasks/${t.id}`} className="font-medium">{t.title}</Link>
              <div><KeyTag>{t.key}</KeyTag></div>
            </div>
          ),
        },
        { title: "Project", key: "project", render: (_, t) => <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> },
        {
          title: "Status",
          key: "status",
          sorter: (a, b) => TASK_STATUS_ORDER.indexOf(a.status) - TASK_STATUS_ORDER.indexOf(b.status),
          render: (_, t) => <TaskStatusPill status={t.status} />,
        },
        {
          title: "Priority",
          key: "priority",
          sorter: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
          render: (_, t) => <PriorityTag priority={t.priority} />,
        },
        { title: "Assignee", key: "assignee", render: (_, t) => <PersonCell name={t.assignee?.name} /> },
        {
          title: "Due",
          key: "due",
          sorter: (a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
          render: (_, t) => {
            if (!t.dueDate) return <Typography.Text type="secondary">—</Typography.Text>;
            const due = dueLabel(t.dueDate, t.status);
            const color = dueColor(due.tone);
            return <Typography.Text style={{ color }} type={color ? undefined : "secondary"}>{due.text}</Typography.Text>;
          },
        },
      ]}
    />
  );
}
