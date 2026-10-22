import { Card, Flex, Progress, Space } from "antd";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { LoadMoreActivity } from "@/components/activity/load-more-activity";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectActions } from "@/components/projects/project-actions";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { Text } from "@/components/ui/antd";
import { AvatarStack, PersonCell } from "@/components/ui/avatar";
import { ProjectStatusPill } from "@/components/ui/badges";
import { forPage, requireCompanyContext } from "@/lib/page-guard";
import { listActivity } from "@/services/activity.service";
import { getProject } from "@/services/project.service";
import { listTasks } from "@/services/task.service";
import { avatarSize, layout, space, textStyle } from "@/lib/design-system";

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
        title={<Space size={space[3]}>{p.name}<ProjectStatusPill status={p.status} /></Space>}
        subtitle={
          <Space size={space[4]} wrap>
            {p.projectManager ? <span>PM · <PersonCell name={p.projectManager.name} size={avatarSize.sm} /></span> : <span>No project manager yet</span>}
            <Link href={`/teams/${p.team.id}`}>Team · {p.team.name}</Link>
            <Space size={space[2]}>
              {p.members.length > 0 && <AvatarStack names={p.members.map(m => m.name)} size={avatarSize.sm} max={4} />}
              <span>{`${p.members.length} member${p.members.length === 1 ? "" : "s"}`}</span>
            </Space>
            <span className="font-mono text-xs">{p.key}</span>
          </Space>
        }
        actions={
          <>
            <Flex vertical align="flex-end" gap={space[0.5]} style={{ width: layout.progressColumnWidth, paddingRight: space[2] }}>
              <Text type="secondary" style={textStyle.caption}>
                <Text strong className="font-mono">{p.counts.DONE} / {p.taskCount}</Text> tasks done
              </Text>
              <Progress percent={p.progress} size="small" showInfo={false} style={{ margin: 0 }} />
            </Flex>
            <ProjectActions project={p} permissions={permissions} />
            {permissions.canCreateTask && <CreateTaskDialog projectId={p.id} projectKey={p.key} canAssign={permissions.canAssignTask} />}
          </>
        }
      >
        <ProjectTabs projectId={p.id} active={activityTab ? "activity" : "board"} />
      </PageHeader>

      {activityTab && activity ? (
        <Card styles={{ body: { padding: 0 } }}>
          <ActivityFeed items={activity.items} showProject={false} empty="Nothing has happened in this project yet." />
          <LoadMoreActivity initialCursor={activity.nextCursor} projectId={p.id} />
        </Card>
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
