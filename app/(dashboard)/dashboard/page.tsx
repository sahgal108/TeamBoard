import type { Metadata } from "next";
import Link from "next/link";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { ProjectStatusPill } from "@/components/ui/badges";
import { roleLabel } from "@/lib/auth/role-label";
import { requireCompanyContext } from "@/lib/page-guard";
import { card, td, th } from "@/lib/ui";
import { getDashboard } from "@/services/dashboard.service";

export const metadata: Metadata = { title: "Dashboard" };

function Tile({ label, value, detail, accent }: { label: string; value: number; detail: string; accent?: boolean }) {
  return (
    <div className={`${card} flex flex-col gap-1.5 px-[18px] py-4`}>
      <span className="text-xs uppercase tracking-[0.06em] text-ink-3">{label}</span>
      <span className={`font-display text-[30px] font-semibold leading-none tabular-nums ${accent ? "text-accent" : ""}`}>{value}</span>
      <span className="text-[12.5px] text-ink-2">{detail}</span>
    </div>
  );
}

export default async function DashboardPage() {
  const ctx = await requireCompanyContext();
  const d = await getDashboard(ctx);
  const s = d.stats;
  const donePct = s.tasks === 0 ? 0 : Math.round((s.done / s.tasks) * 100);

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader
        title={d.scope === "company" ? "Company overview" : "Your overview"}
        subtitle={
          d.scope === "company"
            ? `Everything in ${ctx.company.name}. You see this because your role is ${roleLabel(ctx.membership.role).split(" · ")[0]}.`
            : `Projects you manage, belong to, or share a team with in ${ctx.company.name}. Role: ${roleLabel(ctx.membership.role)}.`
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile label="Teams" value={s.teams} detail={d.scope === "company" ? "across the company" : "you belong to"} />
        <Tile label="Projects" value={s.projects} detail={`${s.activeProjects} active · ${s.plannedProjects} planned`} />
        <Tile label="Tasks" value={s.tasks} detail={`${s.inReview} in review · ${s.urgentOpen} urgent open`} />
        <Tile label="Done" value={s.done} detail={`${donePct}% of ${d.scope === "company" ? "all" : "your"} tasks`} accent />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-sm font-semibold">Projects</h2>
            <Link href="/projects" className="text-[13px] text-accent-ink hover:text-accent">View all</Link>
          </div>
          {d.projects.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">No projects you can see yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={th}>Project</th><th className={th}>Team</th><th className={th}>Project manager</th><th className={th}>Status</th><th className={th}>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {d.projects.map(p => (
                    <tr key={p.id} className="hover:bg-canvas/60">
                      <td className={td}>
                        <Link href={`/projects/${p.id}`} className="font-medium hover:text-accent">{p.name}</Link>
                        <div className="font-mono text-xs text-ink-3">{p.key} · {p.taskCount} tasks</div>
                      </td>
                      <td className={td}>{p.team.name}</td>
                      <td className={td}>
                        {p.projectManager ? (
                          <span className="flex items-center gap-2"><Avatar name={p.projectManager.name} size={24} />{p.projectManager.name}</span>
                        ) : (
                          <span className="text-ink-3">Unassigned</span>
                        )}
                      </td>
                      <td className={td}><ProjectStatusPill status={p.status} /></td>
                      <td className={td}>
                        <span className="flex items-center gap-2.5">
                          <span className="h-1.5 w-[120px] overflow-hidden rounded-full bg-line-2"><b className="block h-full rounded-full bg-accent" style={{ width: `${p.progress}%` }} /></span>
                          <span className="font-mono text-xs text-ink-2">{p.progress}%</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {s.myOpenTasks > 0 && (
            <div className="border-t border-line px-4 py-3 text-[13px] text-ink-2">
              You have <Link href="/tasks?mine=1" className="font-medium text-accent-ink hover:text-accent">{s.myOpenTasks} open task{s.myOpenTasks === 1 ? "" : "s"}</Link> assigned to you.
            </div>
          )}
        </section>

        <section className={`${card} flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md bg-accent-soft px-2 text-[11.5px] font-medium text-accent"><i className="size-1.5 rounded-full bg-accent" />Live</span>
          </div>
          <ActivityFeed items={d.activity} />
          <Link href="/activity" className="mt-auto border-t border-line-2 px-4 py-3 text-[13px] text-accent-ink hover:text-accent">Open activity log</Link>
        </section>
      </div>
    </main>
  );
}
