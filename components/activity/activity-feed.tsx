import { Divider, Flex } from "antd";
import Link from "next/link";
import { Fragment } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, Text } from "@/components/ui/antd";
import { describeActivity } from "@/lib/activity-text";
import { relativeTime } from "@/lib/format";
import type { ActivityItem } from "@/services/activity.service";
import { space, textStyle } from "@/lib/design-system";

export function ActivityRow({ item, showProject = true }: { item: ActivityItem; showProject?: boolean }) {
  const s = describeActivity(item);
  const object = s.href ? <Link href={s.href} className="font-medium">{s.object}</Link> : <Text strong>{s.object}</Text>;
  const where = [showProject ? item.project?.name : null, relativeTime(item.createdAt)].filter(Boolean).join(" · ");
  return (
    <Flex gap={space[3]} style={{ padding: `${space[3]}px ${space[4]}px` }}>
      <Avatar name={item.actor.name} />
      <div className="min-w-0">
        <Text type="secondary">
          <Text strong>{item.actor.name}</Text> {s.verb} {object}
          {s.extra ? ` ${s.extra}` : ""}
        </Text>
        <Text type="secondary" style={{ ...textStyle.caption, display: "block" }}>{where}</Text>
      </div>
    </Flex>
  );
}

export function ActivityFeed({ items, showProject = true, empty = "No activity yet." }: { items: ActivityItem[]; showProject?: boolean; empty?: string }) {
  if (items.length === 0) return <EmptyState description={empty} style={{ padding: `${space[6]}px 0` }} />;
  return (
    <Flex vertical>
      {items.map((i, idx) => (
        <Fragment key={i.id}>
          {idx > 0 && <Divider style={{ margin: 0 }} />}
          <ActivityRow item={i} showProject={showProject} />
        </Fragment>
      ))}
    </Flex>
  );
}
