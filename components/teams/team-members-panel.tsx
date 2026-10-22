"use client";

import { UserAddOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Popconfirm, Table, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FormError } from "@/components/ui/form-error";
import { UserSelect } from "@/components/ui/user-select";
import { api, errorMessage } from "@/lib/client-api";
import { layout, space, textStyle } from "@/lib/design-system";

type Member = { id: string; name: string; email: string; role: string };
type Props = { teamId: string; members: Member[]; canManage: boolean };

export function TeamMembersPanel({ teamId, members, canManage }: Props) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function add() {
    if (!userId) return;
    setPending("add");
    setError(null);
    try {
      await api(`/api/teams/${teamId}/members`, { method: "POST", body: { userId } });
      setUserId(null);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function remove(id: string) {
    setPending(id);
    setError(null);
    try {
      await api(`/api/teams/${teamId}/members/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  return (
    <Card
      title="Members"
      extra={<Typography.Text type="secondary">{members.length}</Typography.Text>}
      styles={{ body: { padding: 0 } }}
      actions={
        canManage
          ? [
              <Flex key="add" vertical gap={space[2]} style={{ padding: `0 ${space[4]}px`, textAlign: "left" }}>
                <Flex gap={space[2]}>
                  <UserSelect value={userId} onChange={setUserId} placeholder="Add a person…" exclude={members.map(m => m.id)} />
                  <Button type="primary" icon={<UserAddOutlined />} onClick={add} disabled={!userId} loading={pending === "add"}>
                    Add
                  </Button>
                </Flex>
                <FormError message={error} />
              </Flex>,
            ]
          : undefined
      }
    >
      <Table<Member>
        rowKey="id"
        size="middle"
        showHeader={false}
        pagination={false}
        dataSource={members}
        locale={{ emptyText: "No members yet." }}
        columns={[
          {
            key: "person",
            render: (_, m) => (
              <Flex align="center" gap={space[3]}>
                <Avatar name={m.name} />
                <div className="min-w-0">
                  <Typography.Text strong ellipsis style={{ display: "block" }}>{m.name}</Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={textStyle.caption}>
                    {m.role.replace(/_/g, " ").toLowerCase()} · {m.email}
                  </Typography.Text>
                </div>
              </Flex>
            ),
          },
          ...(canManage
            ? [
                {
                  key: "remove",
                  align: "right" as const,
                  width: layout.actionColumnWidth,
                  render: (_: unknown, m: Member) => (
                    <Popconfirm title={`Remove ${m.name} from this team?`} okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => remove(m.id)}>
                      <Button size="small" loading={pending === m.id} disabled={pending !== null && pending !== m.id}>
                        Remove
                      </Button>
                    </Popconfirm>
                  ),
                },
              ]
            : []),
        ]}
      />
    </Card>
  );
}
