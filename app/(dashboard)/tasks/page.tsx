import { Card } from "antd";
import type { Metadata } from "next";
import type { TaskStatus } from "@/lib/db/enums";
import { PageHeader } from "@/components/layout/page-header";
import { TasksTable } from "@/components/tables/tasks-table";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TASK_STATUS_ORDER } from "@/lib/labels";
import { requireCompanyContext } from "@/lib/page-guard";
import { listTasks } from "@/services/task.service";

export const metadata: Metadata = { title: "Tasks" };

type Props = { searchParams: Promise<{ mine?: string; status?: string }> };

export default async function TasksPage({ searchParams }: Props) {
  const ctx = await requireCompanyContext();
  const sp = await searchParams;
  const mine = sp.mine === "1";
  const status = TASK_STATUS_ORDER.includes(sp.status as TaskStatus) ? (sp.status as TaskStatus) : undefined;
  const tasks = await listTasks(ctx, { mine: mine ? "1" : undefined, status });

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader title={mine ? "My tasks" : "Tasks"} subtitle={`${tasks.length} task${tasks.length === 1 ? "" : "s"}${mine ? " assigned to you" : " across projects you can see"}.`}>
        <TaskFilters mine={mine} status={status} />
      </PageHeader>
      <Card styles={{ body: { padding: 0 } }}>
        <TasksTable rows={tasks} />
      </Card>
    </main>
  );
}
