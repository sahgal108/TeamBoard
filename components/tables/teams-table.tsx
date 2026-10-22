"use client";

import { Flex, Table, Tag, Typography } from "antd";
import Link from "next/link";
import { AvatarStack } from "@/components/ui/avatar";
import type { TeamListItem } from "@/services/team.service";
import { space, textStyle } from "@/lib/design-system";

export function TeamsTable({ rows }: { rows: TeamListItem[] }) {
  return (
    <Table<TeamListItem>
      rowKey="id"
      dataSource={rows}
      pagination={false}
      locale={{ emptyText: "No teams yet." }}
      columns={[
        {
          title: "Team",
          key: "team",
          render: (_, t) => (
            <div>
              <Link href={`/teams/${t.id}`} className="font-medium">{t.name}</Link>
              {t.description && <Typography.Text type="secondary" style={{ ...textStyle.caption, display: "block" }}>{t.description}</Typography.Text>}
            </div>
          ),
        },
        {
          title: "Members",
          key: "members",
          render: (_, t) => (
            <Flex align="center" gap={space[2]}>
              {t.members.length > 0 && <AvatarStack names={t.members.map(m => m.name)} />}
              <Typography.Text type="secondary">{t.memberCount}</Typography.Text>
            </Flex>
          ),
        },
        { title: "Projects", dataIndex: "projectCount", key: "projects" },
        { key: "you", align: "right", render: (_, t) => (t.isMember ? <Tag color="success">You&apos;re on this team</Tag> : null) },
      ]}
    />
  );
}
