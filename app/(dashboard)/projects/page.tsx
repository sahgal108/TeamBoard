import { Card } from "antd";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectsTable } from "@/components/tables/projects-table";
import { can, hasFullAccess } from "@/lib/auth/permissions";
import { requireCompanyContext } from "@/lib/page-guard";
import { listProjects } from "@/services/project.service";
import { listTeams } from "@/services/team.service";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const ctx = await requireCompanyContext();
  const [projects, teams] = await Promise.all([listProjects(ctx), listTeams(ctx)]);
  const full = hasFullAccess(ctx.membership.role);

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader
        title="Projects"
        subtitle={full ? `All ${projects.length} projects in ${ctx.company.name}.` : `${projects.length} project${projects.length === 1 ? "" : "s"} you manage, belong to, or share a team with.`}
        actions={can(ctx, "project:create") ? <CreateProjectDialog teams={teams.map(t => ({ id: t.id, name: t.name }))} /> : undefined}
      />
      <Card styles={{ body: { padding: 0 } }}>
        <ProjectsTable rows={projects} show={{ team: true, teamLink: true, progress: true }} />
      </Card>
    </main>
  );
}
