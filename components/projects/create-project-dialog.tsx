"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Form, Input, Modal, Select, Tooltip, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormError } from "@/components/ui/form-error";
import { UserSelect } from "@/components/ui/user-select";
import { api, errorMessage } from "@/lib/client-api";
import { layout, space } from "@/lib/design-system";

type Props = { teams: { id: string; name: string }[] };
type Values = { name: string; key: string; teamId: string; projectManagerId?: string | null; description?: string };

/** "Payment Service" → "PAY". Editable afterwards. */
function suggestKey(name: string) {
  const words = name.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 4);
  return words.map(w => w[0]).join("").slice(0, 6);
}

export function CreateProjectDialog({ teams }: Props) {
  const router = useRouter();
  const [form] = Form.useForm<Values>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const keyTouched = useRef(false);

  async function submit(values: Values) {
    setPending(true);
    setError(null);
    try {
      const project = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: { ...values, projectManagerId: values.projectManagerId ?? null, description: values.description || null },
      });
      setOpen(false);
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function openDialog() {
    keyTouched.current = false;
    form.resetFields();
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <Tooltip title={teams.length === 0 ? "Create a team first" : undefined}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openDialog} disabled={teams.length === 0}>
          New project
        </Button>
      </Tooltip>
      <Modal
        open={open}
        title="New project"
        okText="Create project"
        okButtonProps={{ htmlType: "submit", loading: pending }}
        onCancel={() => setOpen(false)}
        forceRender
        modalRender={dom => (
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
           
            initialValues={{ teamId: teams[0]?.id }}
            onFinish={submit}
            onValuesChange={changed => {
              if ("key" in changed) keyTouched.current = true;
              if ("name" in changed && !keyTouched.current) form.setFieldValue("key", suggestKey(changed.name ?? ""));
            }}
          >
            {dom}
          </Form>
        )}
      >
        <Typography.Paragraph type="secondary">Projects belong to a team. The key prefixes every task, e.g. PAY-14.</Typography.Paragraph>
        <Flex gap={space[3]}>
          <Form.Item name="name" label="Name" style={{ flex: 1 }} rules={[{ required: true, whitespace: true, min: 2, max: 80 }]}>
            <Input autoFocus maxLength={80} />
          </Form.Item>
          <Form.Item
            name="key"
            label="Key"
            style={{ width: layout.keyFieldWidth }}
            normalize={(v: string) => v.toUpperCase()}
            rules={[{ required: true, pattern: /^[A-Za-z][A-Za-z0-9]{1,5}$/, message: "2–6 letters or digits" }]}
          >
            <Input maxLength={6} className="font-mono" />
          </Form.Item>
        </Flex>
        <Form.Item name="teamId" label="Team" rules={[{ required: true }]}>
          <Select options={teams.map(t => ({ value: t.id, label: t.name }))} />
        </Form.Item>
        <Form.Item name="projectManagerId" label="Project manager (optional)">
          <UserSelect placeholder="Decide later" />
        </Form.Item>
        <Form.Item name="description" label="Description (optional)">
          <Input.TextArea rows={2} maxLength={1000} />
        </Form.Item>
        <FormError message={error} />
      </Modal>
    </>
  );
}
