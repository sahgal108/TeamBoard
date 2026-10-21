import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { AvatarStack } from "@/components/ui/avatar";
import { can } from "@/lib/auth/permissions";
import { requireCompanyContext } from "@/lib/page-guard";
import { card, td, th } from "@/lib/ui";
import { listTeams } from "@/services/team.service";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const ctx = await requireCompanyContext();
  const teams = await listTeams(ctx);

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader
        title="Teams"
        subtitle={`${teams.length} team${teams.length === 1 ? "" : "s"} in ${ctx.company.name}. Teams are visible to everyone in the company; projects inside them are not.`}
        actions={can(ctx, "team:create") ? <CreateTeamDialog /> : undefined}
      />
      <section className={`${card} overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr><th className={th}>Team</th><th className={th}>Members</th><th className={th}>Projects</th><th className={th}></th></tr>
          </thead>
          <tbody>
            {teams.map(t => (
              <tr key={t.id} className="hover:bg-canvas/60">
                <td className={td}>
                  <Link href={`/teams/${t.id}`} className="font-medium hover:text-accent">{t.name}</Link>
                  {t.description && <div className="text-xs text-ink-3">{t.description}</div>}
                </td>
                <td className={td}>
                  <span className="flex items-center gap-2.5">
                    {t.members.length > 0 ? <AvatarStack names={t.members.map(m => m.name)} /> : null}
                    <span className="text-ink-2">{t.memberCount}</span>
                  </span>
                </td>
                <td className={td}>{t.projectCount}</td>
                <td className={`${td} text-right`}>{t.isMember && <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium text-accent">You&apos;re on this team</span>}</td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr><td className={`${td} py-10 text-center text-ink-3`} colSpan={4}>No teams yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
