import type { Metadata } from "next";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { LoadMoreActivity } from "@/components/activity/load-more-activity";
import { PageHeader } from "@/components/layout/page-header";
import { hasFullAccess } from "@/lib/auth/permissions";
import { requireCompanyContext } from "@/lib/page-guard";
import { card } from "@/lib/ui";
import { listActivity } from "@/services/activity.service";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const ctx = await requireCompanyContext();
  const page = await listActivity(ctx, { limit: 20 });
  const full = hasFullAccess(ctx.membership.role);

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader
        title="Activity"
        subtitle={full ? `Every change in ${ctx.company.name}, newest first. Each row was written in the same transaction as the change it describes.` : "Changes in your projects and teams, plus your own actions, newest first."}
      />
      <section className={`${card} max-w-[860px] overflow-hidden`}>
        <ActivityFeed items={page.items} />
        <LoadMoreActivity initialCursor={page.nextCursor} />
      </section>
    </main>
  );
}
