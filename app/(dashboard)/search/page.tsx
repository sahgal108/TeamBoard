import type { Metadata } from "next";
import Link from "next/link";
import type { ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/layout/page-header";
import { KeyTag, ProjectStatusPill, TaskStatusPill } from "@/components/ui/badges";
import { requireCompanyContext } from "@/lib/page-guard";
import { card } from "@/lib/ui";
import { search } from "@/services/search.service";

export const metadata: Metadata = { title: "Search" };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const ctx = await requireCompanyContext();
  const { q } = await searchParams;
  const term = (q ?? "").trim().slice(0, 100);
  const results = term ? await search(ctx, term) : null;
  const total = results ? results.projects.length + results.tasks.length + results.teams.length : 0;

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader title={term ? `Results for “${term}”` : "Search"} subtitle={term ? `${total} match${total === 1 ? "" : "es"} among the projects, tasks and teams you can see. Try a task key like PAY-8.` : "Type in the search box above."} />
      {results && (
        <div className="grid max-w-[960px] gap-5">
          <Section title="Projects" count={results.projects.length}>
            {results.projects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 border-b border-line-2 px-4 py-3 text-[13px] last:border-b-0 hover:bg-canvas/60">
                <KeyTag>{p.key}</KeyTag><span className="font-medium">{p.name}</span><span className="text-ink-3">{p.team}</span><span className="ml-auto"><ProjectStatusPill status={p.status as ProjectStatus} /></span>
              </Link>
            ))}
          </Section>
          <Section title="Tasks" count={results.tasks.length}>
            {results.tasks.map(t => (
              <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center gap-3 border-b border-line-2 px-4 py-3 text-[13px] last:border-b-0 hover:bg-canvas/60">
                <KeyTag>{t.key}</KeyTag><span className="font-medium">{t.title}</span><span className="text-ink-3">{t.project}{t.assignee ? ` · ${t.assignee}` : ""}</span><span className="ml-auto"><TaskStatusPill status={t.status as TaskStatus} /></span>
              </Link>
            ))}
          </Section>
          <Section title="Teams" count={results.teams.length}>
            {results.teams.map(t => (
              <Link key={t.id} href={`/teams/${t.id}`} className="flex items-center gap-3 border-b border-line-2 px-4 py-3 text-[13px] last:border-b-0 hover:bg-canvas/60">
                <span className="font-medium">{t.name}</span>{t.description && <span className="text-ink-3">{t.description}</span>}
              </Link>
            ))}
          </Section>
        </div>
      )}
    </main>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="text-sm font-semibold">{title}</h2><span className="font-mono text-xs text-ink-3">{count}</span></div>
      {count === 0 ? <p className="px-4 py-5 text-[13px] text-ink-3">No matches.</p> : children}
    </section>
  );
}
