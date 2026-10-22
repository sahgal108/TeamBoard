"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Button, DatePicker, Flex, Form, Input, Modal, Select, Typography } from "antd";
import type { Dayjs } from "dayjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TaskPriority } from "@/lib/db/enums";
import { FormError } from "@/components/ui/form-error";
import { UserSelect } from "@/components/ui/user-select";
import { api, errorMessage } from "@/lib/client-api";
import { PRIORITY_LABEL } from "@/lib/labels";
import { space } from "@/lib/design-system";

type Props = { projectId: string; projectKey: string; canAssign: boolean };
type Values = { title: string; priority: TaskPriority; dueDate?: Dayjs | null; assigneeId?: string | null; description?: string };

export const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABEL) as TaskPriority[]).map(p => ({ value: p, label: PRIORITY_LABEL[p] }));

export function CreateTaskDialog({ projectId, projectKey, canAssign }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(v: Values) {
    setPending(true);
    setError(null);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: {
          projectId,
          title: v.title,
          description: v.description || null,
          priority: v.priority,
          assigneeId: canAssign ? (v.assigneeId ?? null) : null,
          dueDate: v.dueDate ? v.dueDate.format("YYYY-MM-DD") : null,
        },
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => { setError(null); setOpen(true); }}>
        New task
      </Button>
      <Modal
        open={open}
        title="New task"
        okText="Create task"
        okButtonProps={{ htmlType: "submit", loading: pending }}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        modalRender={dom => (
          <Form layout="vertical" requiredMark={false} initialValues={{ priority: "MEDIUM" }} onFinish={submit}>
            {dom}
          </Form>
        )}
      >
        <Typography.Paragraph type="secondary">Gets the next {projectKey} number automatically.</Typography.Paragraph>
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, max: 140 }]}>
          <Input autoFocus maxLength={140} />
        </Form.Item>
        <Flex gap={space[3]}>
          <Form.Item name="priority" label="Priority" style={{ flex: 1 }}>
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>
          <Form.Item name="dueDate" label="Due date" style={{ flex: 1 }}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Flex>
        {canAssign && (
          <Form.Item name="assigneeId" label="Assignee">
            <UserSelect />
          </Form.Item>
        )}
        <Form.Item name="description" label="Description (optional)">
          <Input.TextArea rows={3} maxLength={4000} />
        </Form.Item>
        <FormError message={error} />
      </Modal>
    </>
  );
}
