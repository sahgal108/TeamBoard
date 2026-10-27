import { Card, Col, Row } from "antd";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsTable } from "@/components/tables/projects-table";
import { TeamActions } from "@/components/teams/team-actions";
import { TeamMembersPanel } from "@/components/teams/team-members-panel";
import { SummaryPanel } from "@/components/ai/summary-panel";
import { aiEnabled } from "@/lib/ai/provider";
import { can } from "@/lib/auth/permissions";
import { teamFacts } from "@/lib/authorization/team-access";
import { forPage, requireCompanyContext } from "@/lib/page-guard";
import { getTeam } from "@/services/team.service";
import { space } from "@/lib/design-system";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await requireCompanyContext();
  const { id } = await params;
  const team = await forPage(() => getTeam(ctx, id));
  return { title: team.name };
}

export default async function TeamPage({ params }: Props) {
  const ctx = await requireCompanyContext();
  const { id } = await params;
  const team = await forPage(() => getTeam(ctx, id));
  // Only people who see every project in the team get its summary (see `ai:summarize`).
  const showSummary = aiEnabled() && can(ctx, "ai:summarize", await teamFacts(ctx, team.id));
  const projects = team.projects.map(p => ({
    id: p.id,
    name: p.name,
    key: p.key,
    status: p.status,
    taskCount: p.taskCount,
    projectManager: p.projectManager ? { name: p.projectManager.name } : null,
  }));

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader
        crumbs={[{ label: "Teams", href: "/teams" }, { label: team.name }]}
        title={team.name}
        subtitle={team.description ?? `${team.members.length} members · ${team.projects.length} projects you can see`}
        actions={<TeamActions team={{ id: team.id, name: team.name, description: team.description }} canEdit={team.permissions.canEdit} canDelete={can(ctx, "team:delete")} hasProjects={team.projects.length > 0} />}
      />

      {showSummary && team.projects.length > 0 && (
        <Card title="Team summary">
          <SummaryPanel endpoint={`/api/teams/${team.id}/summary`} showProject />
        </Card>
      )}

      <Row gutter={[space[5], space[5]]}>
        <Col xs={24} xl={16}>
          <Card title="Projects" styles={{ body: { padding: 0 } }}>
            <ProjectsTable rows={projects} show={{ tasks: true }} emptyText="No projects in this team that you can see." />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <TeamMembersPanel teamId={team.id} members={team.members} canManage={team.permissions.canManageMembers} />
        </Col>
      </Row>
    </main>
  );
}
