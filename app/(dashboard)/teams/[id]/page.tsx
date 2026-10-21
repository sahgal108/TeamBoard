import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { TeamActions } from "@/components/teams/team-actions";
import { TeamMembersPanel } from "@/components/teams/team-members-panel";
import { Avatar } from "@/components/ui/avatar";
import { ProjectStatusPill } from "@/components/ui/badges";
import { can } from "@/lib/auth/permissions";
import { forPage, requireCompanyContext } from "@/lib/page-guard";
import { card, td, th } from "@/lib/ui";
import { getTeam } from "@/services/team.service";

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

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader
        crumbs={[{ label: "Teams", href: "/teams" }, { label: team.name }]}
        title={team.name}
        subtitle={team.description ?? `${team.members.length} members · ${team.projects.length} projects you can see`}
        actions={<TeamActions team={{ id: team.id, name: team.name, description: team.description }} canEdit={team.permissions.canEdit} canDelete={can(ctx, "team:delete")} hasProjects={team.projects.length > 0} />}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className={`${card} overflow-hidden`}>
          <div className="border-b border-line px-4 py-3.5"><h2 className="text-sm font-semibold">Projects</h2></div>
          {team.projects.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">No projects in this team that you can see.</p>
          ) : (
            <table className="w-full">
              <thead><tr><th className={th}>Project</th><th className={th}>Project manager</th><th className={th}>Status</th><th className={th}>Tasks</th></tr></thead>
              <tbody>
                {team.projects.map(p => (
                  <tr key={p.id} className="hover:bg-canvas/60">
                    <td className={td}><Link href={`/projects/${p.id}`} className="font-medium hover:text-accent">{p.name}</Link><div className="font-mono text-xs text-ink-3">{p.key}</div></td>
                    <td className={td}>{p.projectManager ? <span className="flex items-center gap-2"><Avatar name={p.projectManager.name} size={24} />{p.projectManager.name}</span> : <span className="text-ink-3">Unassigned</span>}</td>
                    <td className={td}><ProjectStatusPill status={p.status} /></td>
                    <td className={td}>{p.taskCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <TeamMembersPanel teamId={team.id} members={team.members} canManage={team.permissions.canManageMembers} />
      </div>
    </main>
  );
}
