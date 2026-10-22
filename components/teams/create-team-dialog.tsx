"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "@/components/ui/form-error";
import { api, errorMessage } from "@/lib/client-api";

type Values = { name: string; description?: string };

export function CreateTeamDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit({ name, description }: Values) {
    setPending(true);
    setError(null);
    try {
      const team = await api<{ id: string }>("/api/teams", { method: "POST", body: { name, description: description || null } });
      setOpen(false);
      router.push(`/teams/${team.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
        New team
      </Button>
      <Modal
        open={open}
        title="New team"
        okText="Create team"
        okButtonProps={{ htmlType: "submit", loading: pending }}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        modalRender={dom => (
          <Form layout="vertical" requiredMark={false} onFinish={submit}>
            {dom}
          </Form>
        )}
      >
        <Typography.Paragraph type="secondary">A team owns projects. Only company leadership can create one.</Typography.Paragraph>
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, min: 2, max: 60 }]}>
          <Input autoFocus maxLength={60} />
        </Form.Item>
        <Form.Item name="description" label="Description (optional)">
          <Input.TextArea rows={2} maxLength={300} showCount />
        </Form.Item>
        <FormError message={error} />
      </Modal>
    </>
  );
}
