"use client";

import { DeleteOutlined, EditOutlined, TeamOutlined, UserAddOutlined } from "@ant-design/icons";
import { App, Button, Flex, Form, Input, Modal, Popconfirm, Select, Table, Tag, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProjectStatus } from "@/lib/db/enums";
import { Avatar } from "@/components/ui/avatar";
import { FormError } from "@/components/ui/form-error";
import { UserSelect } from "@/components/ui/user-select";
import { api, errorMessage } from "@/lib/client-api";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import type { ProjectSummary } from "@/services/project.service";
import { layout, space, textStyle } from "@/lib/design-system";

type Perms = { canEdit: boolean; canDelete: boolean; canAssignPm: boolean; canManageMembers: boolean };
type Props = { project: ProjectSummary; permissions: Perms };
type Values = { name: string; status: ProjectStatus; projectManagerId?: string | null; description?: string };
type Member = ProjectSummary["members"][number];

export function ProjectActions({ project, permissions }: Props) {
  const router = useRouter();
  const { modal, message } = App.useApp();
  const [editOpen, setEditOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [newMember, setNewMember] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const pmId = project.projectManager?.id ?? null;

  async function save(values: Values) {
    setPending("save");
    setError(null);
    try {
      const body: Record<string, unknown> = { name: values.name, description: values.description || null, status: values.status };
      const nextPm = values.projectManagerId ?? null;
      if (permissions.canAssignPm && nextPm !== pmId) body.projectManagerId = nextPm;
      await api(`/api/projects/${project.id}`, { method: "PATCH", body });
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  function remove() {
    modal.confirm({
      title: `Delete "${project.name}"?`,
      content: `All ${project.taskCount} of its tasks go with it. This cannot be undone.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api(`/api/projects/${project.id}`, { method: "DELETE" });
          router.push("/projects");
          router.refresh();
        } catch (err) {
          message.error(errorMessage(err));
        }
      },
    });
  }

  async function addMember() {
    if (!newMember) return;
    setPending("add");
    setError(null);
    try {
      await api(`/api/projects/${project.id}/members`, { method: "POST", body: { userId: newMember } });
      setNewMember(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function removeMember(userId: string) {
    setPending(userId);
    setError(null);
    try {
      await api(`/api/projects/${project.id}/members/${userId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Button icon={<TeamOutlined />} onClick={() => { setError(null); setMembersOpen(true); }}>
        Members · {project.members.length}
      </Button>
      {permissions.canEdit && (
        <Button icon={<EditOutlined />} onClick={() => { setError(null); setEditOpen(true); }}>
          Edit
        </Button>
      )}
      {permissions.canDelete && (
        <Button danger icon={<DeleteOutlined />} onClick={remove}>
          Delete
        </Button>
      )}

      <Modal
        open={editOpen}
        title="Edit project"
        okText="Save"
        okButtonProps={{ htmlType: "submit", loading: pending === "save" }}
        onCancel={() => setEditOpen(false)}
        destroyOnHidden
        modalRender={dom => (
          <Form
            layout="vertical"
            requiredMark={false}
           
            initialValues={{ name: project.name, status: project.status, projectManagerId: pmId, description: project.description ?? "" }}
            onFinish={save}
          >
            {dom}
          </Form>
        )}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, min: 2, max: 80 }]}>
          <Input maxLength={80} />
        </Form.Item>
        <Form.Item name="status" label="Status">
          <Select options={(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map(s => ({ value: s, label: PROJECT_STATUS_LABEL[s] }))} />
        </Form.Item>
        <Form.Item
          name="projectManagerId"
          label="Project manager"
          extra={permissions.canAssignPm ? undefined : "Only company leadership can change this."}
        >
          <UserSelect placeholder="Unassigned" disabled={!permissions.canAssignPm} />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} maxLength={1000} />
        </Form.Item>
        <FormError message={error} />
      </Modal>

      <Modal open={membersOpen} title="Project members" footer={null} onCancel={() => setMembersOpen(false)} width={layout.modalWidth}>
        <Typography.Paragraph type="secondary">
          Members can see this project and its tasks. The team&apos;s members and the project manager can see it regardless.
        </Typography.Paragraph>
        <Table<Member>
          rowKey="id"
          size="small"
          showHeader={false}
          pagination={false}
          dataSource={project.members}
          locale={{ emptyText: "No explicit members yet." }}
          columns={[
            {
              key: "person",
              render: (_, m) => (
                <Flex align="center" gap={space[3]}>
                  <Avatar name={m.name} />
                  <div className="min-w-0">
                    <Typography.Text strong>{m.name}</Typography.Text>
                    {m.id === pmId && <Tag color="success" style={{ marginInlineStart: space[2] }}>PM</Tag>}
                    <Typography.Text type="secondary" ellipsis style={{ ...textStyle.caption, display: "block" }}>{m.email}</Typography.Text>
                  </div>
                </Flex>
              ),
            },
            ...(permissions.canManageMembers
              ? [
                  {
                    key: "remove",
                    align: "right" as const,
                    width: layout.actionColumnWidth,
                    render: (_: unknown, m: Member) =>
                      m.id === pmId ? null : (
                        <Popconfirm title={`Remove ${m.name}?`} okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => removeMember(m.id)}>
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
        {permissions.canManageMembers && (
          <Flex vertical gap={space[2]} style={{ marginTop: space[4] }}>
            <Flex gap={space[2]}>
              <UserSelect value={newMember} onChange={setNewMember} placeholder="Add a person…" exclude={project.members.map(m => m.id)} />
              <Button type="primary" icon={<UserAddOutlined />} onClick={addMember} disabled={!newMember} loading={pending === "add"}>
                Add
              </Button>
            </Flex>
            <FormError message={error} />
          </Flex>
        )}
      </Modal>
    </>
  );
}
