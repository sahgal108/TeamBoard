import type { Metadata } from "next";
import Link from "next/link";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { LoadMoreActivity } from "@/components/activity/load-more-activity";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectActions } from "@/components/projects/project-actions";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { ProjectStatusPill } from "@/components/ui/badges";
import { forPage, requireCompanyContext } from "@/lib/page-guard";
import { card } from "@/lib/ui";
import { listActivity } from "@/services/activity.service";
import { getProject } from "@/services/project.service";
import { listTasks } from "@/services/task.service";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await requireCompanyContext();
  const { id } = await params;
  const { summary } = await forPage(() => getProject(ctx, id));
  return { title: summary.name };
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const ctx = await requireCompanyContext();
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const { summary: p, permissions } = await forPage(() => getProject(ctx, id));
  const activityTab = tab === "activity";
  const [tasks, activity] = await Promise.all([
    activityTab ? Promise.resolve([]) : listTasks(ctx, { projectId: p.id }),
    activityTab ? listActivity(ctx, { projectId: p.id, limit: 20 }) : Promise.resolve(null),
  ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-5 p-7">
      <PageHeader
        crumbs={[{ label: "Projects", href: "/projects" }, { label: p.name }]}
        title={<span className="flex items-center gap-3">{p.name}<ProjectStatusPill status={p.status} /></span>}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="flex items-center gap-2">{p.projectManager ? <><Avatar name={p.projectManager.name} size={22} />PM · {p.projectManager.name}</> : <span className="text-ink-3">No project manager yet</span>}</span>
            <Link href={`/teams/${p.team.id}`} className="hover:text-accent">Team · {p.team.name}</Link>
            <span className="flex items-center gap-2"><AvatarStack names={p.members.map(m => m.name)} size={22} max={4} />{p.members.length} member{p.members.length === 1 ? "" : "s"}</span>
            <span className="font-mono text-xs text-ink-3">{p.key}</span>
          </span>
        }
        actions={
          <>
            <div className="flex flex-col items-end gap-1.5 pr-2">
              <span className="text-xs text-ink-2"><span className="font-mono font-medium text-ink">{p.counts.DONE} / {p.taskCount}</span> tasks done</span>
              <span className="h-1.5 w-[180px] overflow-hidden rounded-full bg-line-2"><b className="block h-full rounded-full bg-accent" style={{ width: `${p.progress}%` }} /></span>
            </div>
            <ProjectActions project={p} permissions={permissions} />
            {permissions.canCreateTask && <CreateTaskDialog projectId={p.id} projectKey={p.key} canAssign={permissions.canAssignTask} />}
          </>
        }
      >
        <nav className="flex gap-1 border-b border-line" aria-label="Project sections">
          {[
            { href: `/projects/${p.id}`, label: "Board", on: !activityTab },
            { href: `/projects/${p.id}?tab=activity`, label: "Activity", on: activityTab },
          ].map(t => (
            <Link key={t.label} href={t.href} className={`-mb-px border-b-2 px-3 py-2.5 text-[13.5px] font-medium ${t.on ? "border-accent text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
              {t.label}
            </Link>
          ))}
        </nav>
      </PageHeader>

      {activityTab && activity ? (
        <section className={`${card} overflow-hidden`}>
          <ActivityFeed items={activity.items} showProject={false} empty="Nothing has happened in this project yet." />
          <LoadMoreActivity initialCursor={activity.nextCursor} projectId={p.id} />
        </section>
      ) : (
        <KanbanBoard
          projectId={p.id}
          tasks={tasks}
          meId={ctx.user.id}
          canManage={permissions.canAssignTask}
          isViewer={ctx.membership.role === "VIEWER"}
        />
      )}
    </main>
  );
}
