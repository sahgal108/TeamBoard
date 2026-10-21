import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { describeActivity } from "@/lib/activity-text";
import { relativeTime } from "@/lib/format";
import type { ActivityItem } from "@/services/activity.service";

export function ActivityRow({ item, showProject = true }: { item: ActivityItem; showProject?: boolean }) {
  const s = describeActivity(item);
  const object = s.href ? <Link href={s.href} className="font-medium text-ink hover:text-accent">{s.object}</Link> : <span className="font-medium text-ink">{s.object}</span>;
  const where = [showProject ? item.project?.name : null, relativeTime(item.createdAt)].filter(Boolean).join(" · ");
  return (
    <div className="flex gap-3 border-b border-line-2 px-4 py-3 text-[13px] last:border-b-0">
      <Avatar name={item.actor.name} />
      <div className="min-w-0">
        <div className="text-ink-2">
          <span className="font-medium text-ink">{item.actor.name}</span> {s.verb} {object}
          {s.extra ? ` ${s.extra}` : ""}
        </div>
        <div className="mt-0.5 text-xs text-ink-3">{where}</div>
      </div>
    </div>
  );
}

export function ActivityFeed({ items, showProject = true, empty = "No activity yet." }: { items: ActivityItem[]; showProject?: boolean; empty?: string }) {
  if (items.length === 0) return <div className="px-4 py-8 text-center text-[13px] text-ink-3">{empty}</div>;
  return (
    <div className="flex flex-col">
      {items.map(i => (
        <ActivityRow key={i.id} item={i} showProject={showProject} />
      ))}
    </div>
  );
}
