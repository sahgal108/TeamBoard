import { Badge, Card, Divider, Flex } from "antd";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { ProjectStatus, TaskStatus } from "@/lib/db/enums";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, Text } from "@/components/ui/antd";
import { KeyTag, ProjectStatusPill, TaskStatusPill } from "@/components/ui/badges";
import { requireCompanyContext } from "@/lib/page-guard";
import { search } from "@/services/search.service";
import { color, layout, space } from "@/lib/design-system";

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
        <Flex vertical gap={space[5]} style={{ maxWidth: layout.contentMaxWidth }}>
          <Section title="Projects" rows={results.projects.map(p => ({
            key: p.id,
            href: `/projects/${p.id}`,
            body: <><KeyTag>{p.key}</KeyTag><Text strong>{p.name}</Text><Text type="secondary">{p.team}</Text></>,
            end: <ProjectStatusPill status={p.status as ProjectStatus} />,
          }))} />
          <Section title="Tasks" rows={results.tasks.map(t => ({
            key: t.id,
            href: `/tasks/${t.id}`,
            body: <><KeyTag>{t.key}</KeyTag><Text strong>{t.title}</Text><Text type="secondary">{t.project}{t.assignee ? ` · ${t.assignee}` : ""}</Text></>,
            end: <TaskStatusPill status={t.status as TaskStatus} />,
          }))} />
          <Section title="Teams" rows={results.teams.map(t => ({
            key: t.id,
            href: `/teams/${t.id}`,
            body: <><Text strong>{t.name}</Text>{t.description && <Text type="secondary">{t.description}</Text>}</>,
          }))} />
        </Flex>
      )}
    </main>
  );
}

type Row = { key: string; href: string; body: ReactNode; end?: ReactNode };

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <Card title={title} extra={<Badge count={rows.length} showZero color={color.neutral.borderSubtle} style={{ color: color.neutral.textSecondary }} />} styles={{ body: { padding: 0 } }}>
      {rows.length === 0 ? (
        <EmptyState description="No matches." />
      ) : (
        rows.map((r, i) => (
          <Fragment key={r.key}>
            {i > 0 && <Divider style={{ margin: 0 }} />}
            <Link href={r.href} className="block px-4 py-3 hover:bg-canvas/60">
              <Flex align="center" gap={space[3]}>
                {r.body}
                {r.end && <span style={{ marginLeft: "auto" }}>{r.end}</span>}
              </Flex>
            </Link>
          </Fragment>
        ))
      )}
    </Card>
  );
}
