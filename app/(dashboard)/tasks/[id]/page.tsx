import type { Metadata } from "next";
import { TaskDetail } from "@/components/tasks/task-detail";
import { forPage, requireCompanyContext } from "@/lib/page-guard";
import { getTask } from "@/services/task.service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await requireCompanyContext();
  const { id } = await params;
  const task = await forPage(() => getTask(ctx, id));
  return { title: `${task.key} ${task.title}` };
}

export default async function TaskPage({ params }: Props) {
  const ctx = await requireCompanyContext();
  const { id } = await params;
  const task = await forPage(() => getTask(ctx, id));
  return <TaskDetail task={task} meId={ctx.user.id} />;
}
