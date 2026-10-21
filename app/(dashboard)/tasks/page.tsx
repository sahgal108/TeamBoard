import type { Metadata } from "next";
import Link from "next/link";
import type { TaskStatus } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { KeyTag, PriorityTag, TaskStatusPill } from "@/components/ui/badges";
import { dueLabel } from "@/lib/format";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER } from "@/lib/labels";
import { requireCompanyContext } from "@/lib/page-guard";
import { card, td, th } from "@/lib/ui";
import { listTasks } from "@/services/task.service";

export const metadata: Metadata = { title: "Tasks" };

type Props = { searchParams: Promise<{ mine?: string; status?: string }> };

export default async function TasksPage({ searchParams }: Props) {
  const ctx = await requireCompanyContext();
  const sp = await searchParams;
  const mine = sp.mine === "1";
  const status = TASK_STATUS_ORDER.includes(sp.status as TaskStatus) ? (sp.status as TaskStatus) : undefined;
  const tasks = await listTasks(ctx, { mine: mine ? "1" : undefined, status });

  const filterHref = (next: { mine?: boolean; status?: TaskStatus | null }) => {
    const q = new URLSearchParams();
    const m = next.mine ?? mine;
    const s = next.status === undefined ? status : next.status;
    if (m) q.set("mine", "1");
    if (s) q.set("status", s);
    const str = q.toString();
    return `/tasks${str ? `?${str}` : ""}`;
  };
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink-2 hover:border-ink-3"}`;

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader title={mine ? "My tasks" : "Tasks"} subtitle={`${tasks.length} task${tasks.length === 1 ? "" : "s"}${mine ? " assigned to you" : " across projects you can see"}.`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={filterHref({ mine: false })} className={chip(!mine)}>All</Link>
          <Link href={filterHref({ mine: true })} className={chip(mine)}>Assigned to me</Link>
          <span className="mx-1 h-5 w-px bg-line" />
          <Link href={filterHref({ status: null })} className={chip(!status)}>Any status</Link>
          {TASK_STATUS_ORDER.map(s => (
            <Link key={s} href={filterHref({ status: s })} className={chip(status === s)}>{TASK_STATUS_LABEL[s]}</Link>
          ))}
        </div>
      </PageHeader>

      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className={th}>Task</th><th className={th}>Project</th><th className={th}>Status</th><th className={th}>Priority</th><th className={th}>Assignee</th><th className={th}>Due</th></tr></thead>
            <tbody>
              {tasks.map(t => {
                const due = dueLabel(t.dueDate, t.status);
                return (
                  <tr key={t.id} className="hover:bg-canvas/60">
                    <td className={td}><Link href={`/tasks/${t.id}`} className="font-medium hover:text-accent">{t.title}</Link><div><KeyTag>{t.key}</KeyTag></div></td>
                    <td className={td}><Link href={`/projects/${t.project.id}`} className="hover:text-accent">{t.project.name}</Link></td>
                    <td className={td}><TaskStatusPill status={t.status} /></td>
                    <td className={td}><PriorityTag priority={t.priority} /></td>
                    <td className={td}>{t.assignee ? <span className="flex items-center gap-2"><Avatar name={t.assignee.name} size={24} />{t.assignee.name}</span> : <span className="text-ink-3">Unassigned</span>}</td>
                    <td className={`${td} ${due.tone === "overdue" ? "text-priority-urgent" : due.tone === "soon" ? "text-status-review" : "text-ink-2"}`}>{t.dueDate ? due.text : <span className="text-ink-3">—</span>}</td>
                  </tr>
                );
              })}
              {tasks.length === 0 && <tr><td className={`${td} py-10 text-center text-ink-3`} colSpan={6}>No tasks match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
