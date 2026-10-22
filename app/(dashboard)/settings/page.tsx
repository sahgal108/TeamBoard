import { Card, Col, Descriptions, Divider, Flex, Row, Tag } from "antd";
import type { Metadata } from "next";
import type { CompanyRole } from "@/lib/db/enums";
import { PageHeader } from "@/components/layout/page-header";
import { Paragraph, Text } from "@/components/ui/antd";
import { Avatar } from "@/components/ui/avatar";
import { can, type Action } from "@/lib/auth/permissions";
import { roleLabel } from "@/lib/auth/role-label";
import { requireCompanyContext } from "@/lib/page-guard";
import { listCompanies } from "@/services/auth.service";
import { avatarSize, layout, space } from "@/lib/design-system";

export const metadata: Metadata = { title: "Settings" };

const ROWS: { label: string; action: Action; facts?: Parameters<typeof can>[2]; note?: string }[] = [
  { label: "Create teams and projects", action: "project:create" },
  { label: "Assign project managers", action: "project:assign_pm" },
  { label: "Edit a project you manage", action: "project:update", facts: { isProjectManager: true } },
  { label: "Edit a project on your team", action: "project:update", facts: { isTeamMember: true } },
  { label: "Create tasks in a project you manage", action: "task:create", facts: { isProjectManager: true } },
  { label: "Change status of a task assigned to you", action: "task:update_status", facts: { isAssignee: true, isProjectMember: true } },
  { label: "Comment on a project you are part of", action: "comment:create", facts: { isProjectMember: true } },
  { label: "See company-wide activity", action: "activity:read_company" },
];

export default async function SettingsPage() {
  const ctx = await requireCompanyContext();
  const companies = await listCompanies(ctx.user.id);
  const role = ctx.membership.role as CompanyRole;

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader title="Settings" subtitle="Your account, your companies, and what your role lets you do here." />
      <Row gutter={[space[5], space[5]]} style={{ maxWidth: layout.contentMaxWidth }}>
        <Col xs={24} xl={12}>
          <Card title="Account">
            <Flex align="center" gap={space[3]}>
              <Avatar name={ctx.user.name} size={avatarSize.lg} />
              <div>
                <Text strong style={{ display: "block" }}>{ctx.user.name}</Text>
                <Text type="secondary">{ctx.user.email}</Text>
              </div>
            </Flex>
            <Divider titlePlacement="start" plain>Companies</Divider>
            <Descriptions
              column={1}
              size="small"
              items={companies.map(c => ({
                key: c.id,
                label: (
                  <span>
                    {c.name}
                    {c.id === ctx.company.id && <Tag color="success" style={{ marginInlineStart: space[2] }}>active</Tag>}
                  </span>
                ),
                children: <Text type="secondary">{roleLabel(c.role)}</Text>,
              }))}
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title={`Your permissions in ${ctx.company.name}`}>
            <Paragraph type="secondary">
              Role: {roleLabel(role)}. Every request is checked against this on the server; the interface only hides what you cannot do.
            </Paragraph>
            <Descriptions
              column={1}
              size="small"
              bordered
              items={ROWS.map(r => {
                const ok = can(ctx, r.action, r.facts);
                return { key: r.label, label: r.label, children: <Tag color={ok ? "success" : "default"}>{ok ? "Allowed" : "Not allowed"}</Tag> };
              })}
            />
          </Card>
        </Col>
      </Row>
    </main>
  );
}
