import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { Avatar } from "@/components/ui/avatar";
import { ProjectStatusPill } from "@/components/ui/badges";
import { can, hasFullAccess } from "@/lib/auth/permissions";
import { requireCompanyContext } from "@/lib/page-guard";
import { card, td, th } from "@/lib/ui";
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
      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className={th}>Project</th><th className={th}>Team</th><th className={th}>Project manager</th><th className={th}>Status</th><th className={th}>Progress</th></tr></thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="hover:bg-canvas/60">
                  <td className={td}>
                    <Link href={`/projects/${p.id}`} className="font-medium hover:text-accent">{p.name}</Link>
                    <div className="font-mono text-xs text-ink-3">{p.key} · {p.taskCount} tasks</div>
                  </td>
                  <td className={td}><Link href={`/teams/${p.team.id}`} className="hover:text-accent">{p.team.name}</Link></td>
                  <td className={td}>{p.projectManager ? <span className="flex items-center gap-2"><Avatar name={p.projectManager.name} size={24} />{p.projectManager.name}</span> : <span className="text-ink-3">Unassigned</span>}</td>
                  <td className={td}><ProjectStatusPill status={p.status} /></td>
                  <td className={td}>
                    <span className="flex items-center gap-2.5">
                      <span className="h-1.5 w-[120px] overflow-hidden rounded-full bg-line-2"><b className="block h-full rounded-full bg-accent" style={{ width: `${p.progress}%` }} /></span>
                      <span className="font-mono text-xs text-ink-2">{p.progress}%</span>
                    </span>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && <tr><td className={`${td} py-10 text-center text-ink-3`} colSpan={5}>No projects you can see yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
