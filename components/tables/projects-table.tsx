"use client";

import { Progress, Table, type TableColumnsType } from "antd";
import Link from "next/link";
import type { ProjectStatus } from "@/lib/db/enums";
import { PersonCell } from "@/components/ui/avatar";
import { ProjectStatusPill } from "@/components/ui/badges";
import { layout } from "@/lib/design-system";

export type ProjectRow = {
  id: string;
  name: string;
  key: string;
  status: ProjectStatus;
  taskCount: number;
  team?: { id: string; name: string };
  projectManager: { name: string } | null;
  progress?: number;
};

type Props = {
  rows: ProjectRow[];
  /** Which optional columns to show. Team links to the team page when `teamLink` is set. */
  show?: { team?: boolean; teamLink?: boolean; progress?: boolean; tasks?: boolean };
  emptyText?: string;
};

export function ProjectsTable({ rows, show = { team: true, progress: true }, emptyText = "No projects you can see yet." }: Props) {
  const columns: TableColumnsType<ProjectRow> = [
    {
      title: "Project",
      key: "project",
      render: (_, p) => (
        <div>
          <Link href={`/projects/${p.id}`} className="font-medium">{p.name}</Link>
          <div className="font-mono text-xs text-ink-3">
            {p.key}
            {show.tasks ? "" : ` · ${p.taskCount} tasks`}
          </div>
        </div>
      ),
    },
  ];
  if (show.team) {
    columns.push({
      title: "Team",
      key: "team",
      render: (_, p) => (p.team ? show.teamLink ? <Link href={`/teams/${p.team.id}`}>{p.team.name}</Link> : p.team.name : null),
    });
  }
  columns.push(
    { title: "Project manager", key: "pm", render: (_, p) => <PersonCell name={p.projectManager?.name} /> },
    { title: "Status", key: "status", render: (_, p) => <ProjectStatusPill status={p.status} /> },
  );
  if (show.progress) {
    columns.push({ title: "Progress", key: "progress", width: layout.progressColumnWidth, render: (_, p) => <Progress percent={p.progress ?? 0} size="small" /> });
  }
  if (show.tasks) {
    columns.push({ title: "Tasks", dataIndex: "taskCount", key: "tasks", align: "right" });
  }

  return <Table<ProjectRow> rowKey="id" columns={columns} dataSource={rows} pagination={false} scroll={{ x: "max-content" }} locale={{ emptyText }} />;
}
