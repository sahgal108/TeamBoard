"use client";

import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/ui/form-error";
import { api, errorMessage } from "@/lib/client-api";

type Props = { team: { id: string; name: string; description: string | null }; canEdit: boolean; canDelete: boolean; hasProjects: boolean };
type Values = { name: string; description?: string };

export function TeamActions({ team, canEdit, canDelete, hasProjects }: Props) {
  const router = useRouter();
  const { modal, message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canEdit && !canDelete) return null;

  async function save({ name, description }: Values) {
    setPending(true);
    setError(null);
    try {
      await api(`/api/teams/${team.id}`, { method: "PATCH", body: { name, description: description || null } });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function remove() {
    modal.confirm({
      title: `Delete team "${team.name}"?`,
      content: "This cannot be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api(`/api/teams/${team.id}`, { method: "DELETE" });
          router.push("/teams");
          router.refresh();
        } catch (err) {
          message.error(errorMessage(err));
        }
      },
    });
  }

  return (
    <>
      {canEdit && (
        <Button icon={<EditOutlined />} onClick={() => setOpen(true)}>
          Edit team
        </Button>
      )}
      {canDelete && (
        <Tooltip title={hasProjects ? "Move or delete this team's projects first" : undefined}>
          <Button danger icon={<DeleteOutlined />} onClick={remove} disabled={hasProjects}>
            Delete
          </Button>
        </Tooltip>
      )}
      <Modal
        open={open}
        title="Edit team"
        okText="Save"
        okButtonProps={{ htmlType: "submit", loading: pending }}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        modalRender={dom => (
          <Form layout="vertical" requiredMark={false} initialValues={{ name: team.name, description: team.description ?? "" }} onFinish={save}>
            {dom}
          </Form>
        )}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, min: 2, max: 60 }]}>
          <Input maxLength={60} />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} maxLength={300} showCount />
        </Form.Item>
        <FormError message={error} />
      </Modal>
    </>
  );
}
