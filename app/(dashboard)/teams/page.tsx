import { Card } from "antd";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TeamsTable } from "@/components/tables/teams-table";
import { CreateTeamDialog } from "@/components/teams/create-team-dialog";
import { can } from "@/lib/auth/permissions";
import { requireCompanyContext } from "@/lib/page-guard";
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
      <Card styles={{ body: { padding: 0 } }}>
        <TeamsTable rows={teams} />
      </Card>
    </main>
  );
}
