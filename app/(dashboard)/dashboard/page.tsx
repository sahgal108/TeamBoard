import { Badge, Card, Col, Row, Statistic } from "antd";
import type { Metadata } from "next";
import Link from "next/link";
import { SummaryPanel } from "@/components/ai/summary-panel";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectsTable } from "@/components/tables/projects-table";
import { Text } from "@/components/ui/antd";
import { aiEnabled } from "@/lib/ai/provider";
import { can } from "@/lib/auth/permissions";
import { roleLabel } from "@/lib/auth/role-label";
import { requireCompanyContext } from "@/lib/page-guard";
import { getDashboard } from "@/services/dashboard.service";
import { color, font, space, textStyle } from "@/lib/design-system";

export const metadata: Metadata = { title: "Dashboard" };

function Tile({ label, value, detail, accent }: { label: string; value: number; detail: string; accent?: boolean }) {
  return (
    <Card>
      <Statistic title={label} value={value} styles={{ content: { fontSize: font.size["3xl"], fontWeight: font.weight.semibold, color: accent ? color.brand.primary : undefined } }} />
      <Text type="secondary" style={textStyle.caption}>{detail}</Text>
    </Card>
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

      <Row gutter={[space[4], space[4]]}>
        <Col xs={12} xl={6}><Tile label="Teams" value={s.teams} detail={d.scope === "company" ? "across the company" : "you belong to"} /></Col>
        <Col xs={12} xl={6}><Tile label="Projects" value={s.projects} detail={`${s.activeProjects} active · ${s.plannedProjects} planned`} /></Col>
        <Col xs={12} xl={6}><Tile label="Tasks" value={s.tasks} detail={`${s.inReview} in review · ${s.urgentOpen} urgent open`} /></Col>
        <Col xs={12} xl={6}><Tile label="Done" value={s.done} detail={`${donePct}% of ${d.scope === "company" ? "all" : "your"} tasks`} accent /></Col>
      </Row>

      {/* Company digest: leadership only (`ai:summarize` with no facts). */}
      {aiEnabled() && can(ctx, "ai:summarize") && (
        <Card title="Company digest">
          <SummaryPanel endpoint="/api/summary" defaultPeriod="week" showProject />
        </Card>
      )}

      <Row gutter={[space[5], space[5]]}>
        <Col xs={24} xl={16}>
          <Card
            title="Projects"
            extra={<Link href="/projects">View all</Link>}
            styles={{ body: { padding: 0 } }}
            actions={
              s.myOpenTasks > 0
                ? [
                    <Text key="mine" type="secondary" style={{ display: "block", textAlign: "left", padding: `0 ${space[4]}px` }}>
                      You have <Link href="/tasks?mine=1">{s.myOpenTasks} open task{s.myOpenTasks === 1 ? "" : "s"}</Link> assigned to you.
                    </Text>,
                  ]
                : undefined
            }
          >
            <ProjectsTable rows={d.projects} show={{ team: true, progress: true }} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card
            title="Recent activity"
            extra={<Badge status="processing" text="Live" />}
            styles={{ body: { padding: 0 } }}
            actions={[<Link key="log" href="/activity" style={{ display: "block", textAlign: "left", padding: `0 ${space[4]}px` }}>Open activity log</Link>]}
          >
            <ActivityFeed items={d.activity} />
          </Card>
        </Col>
      </Row>
    </main>
  );
}
