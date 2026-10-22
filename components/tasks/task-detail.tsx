"use client";

import { DeleteOutlined, EditOutlined, SendOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, DatePicker, Descriptions, Flex, Form, Input, Modal, Row, Select, Space, Timeline, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TaskPriority, TaskStatus } from "@/lib/db/enums";
import { PageHeader } from "@/components/layout/page-header";
import { PRIORITY_OPTIONS } from "@/components/tasks/create-task-dialog";
import { EmptyState } from "@/components/ui/antd";
import { Avatar, PersonCell } from "@/components/ui/avatar";
import { KeyTag, PriorityTag, TaskStatusPill } from "@/components/ui/badges";
import { FormError } from "@/components/ui/form-error";
import { UserSelect } from "@/components/ui/user-select";
import { avatarSize, space, textStyle } from "@/lib/design-system";
import { describeActivity } from "@/lib/activity-text";
import { api, errorMessage } from "@/lib/client-api";
import { dueColor, dueLabel, formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { TASK_STATUS_LABEL } from "@/lib/labels";
import type { getTask } from "@/services/task.service";

type Task = Awaited<ReturnType<typeof getTask>>;
type Props = { task: Task; meId: string };
type EditValues = { title: string; priority: TaskPriority; dueDate?: Dayjs | null; description?: string };

const SECTION_TITLE = textStyle.sectionLabel;

export function TaskDetail({ task, meId }: Props) {
  const router = useRouter();
  const { modal } = App.useApp();
  const p = task.permissions;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const due = dueLabel(task.dueDate, task.status);

  async function run(key: string, fn: () => Promise<unknown>, after?: () => void) {
    setPending(key);
    setError(null);
    try {
      await fn();
      after?.();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  const move = (to: TaskStatus) => run(`status:${to}`, () => api(`/api/tasks/${task.id}/status`, { method: "PATCH", body: { status: to } }));
  const assign = (assigneeId: string | null) => run("assign", () => api(`/api/tasks/${task.id}/assignee`, { method: "PATCH", body: { assigneeId } }));
  const remove = () =>
    modal.confirm({
      title: `Delete ${task.key}?`,
      content: `"${task.title}" and its comments will be removed.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: () => run("delete", () => api(`/api/tasks/${task.id}`, { method: "DELETE" }), () => router.push(`/projects/${task.project.id}`)),
    });
  const saveEdit = (v: EditValues) => {
    const body: Record<string, unknown> = { description: v.description || null, dueDate: v.dueDate ? v.dueDate.format("YYYY-MM-DD") : null };
    if (p.canEditAll) Object.assign(body, { title: v.title, priority: v.priority });
    void run("edit", () => api(`/api/tasks/${task.id}`, { method: "PATCH", body }), () => setEditOpen(false));
  };
  const postComment = () => {
    if (!comment.trim()) return;
    void run("comment", () => api(`/api/tasks/${task.id}/comments`, { method: "POST", body: { content: comment } }), () => setComment(""));
  };

  const dueTextColor = dueColor(due.tone);

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader
        crumbs={[{ label: "Projects", href: "/projects" }, { label: task.project.name, href: `/projects/${task.project.id}` }, { label: task.key }]}
        title={task.title}
        subtitle={
          <Space size={space[3]} wrap>
            <KeyTag>{task.key}</KeyTag>
            <TaskStatusPill status={task.status} />
            <PriorityTag priority={task.priority} />
            <span>Created by {task.createdBy.name} · {formatDate(task.createdAt)}</span>
          </Space>
        }
        actions={
          <>
            {p.canEdit && <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>Edit</Button>}
            {p.canDelete && <Button danger icon={<DeleteOutlined />} onClick={remove} loading={pending === "delete"}>Delete</Button>}
          </>
        }
      />
      <FormError message={error} />

      <Row gutter={[space[5], space[5]]}>
        <Col xs={24} xl={16}>
          <Flex vertical gap={space[5]}>
            <Card title={<span style={SECTION_TITLE}>Description</span>}>
              {task.description ? (
                <Typography.Paragraph type="secondary" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{task.description}</Typography.Paragraph>
              ) : (
                <Typography.Text type="secondary">No description yet.</Typography.Text>
              )}
            </Card>

            <Card title={<span style={SECTION_TITLE}>Comments · {task.comments.length}</span>}>
              <Flex vertical gap={space[3]}>
                {task.comments.map(c => (
                  <Flex key={c.id} gap={space[3]}>
                    <Avatar name={c.author.name} />
                    <div className="min-w-0">
                      <Typography.Text strong>{c.author.name}</Typography.Text>{" "}
                      <Typography.Text type="secondary">{c.content}</Typography.Text>
                      <Typography.Text type="secondary" style={{ ...textStyle.caption, display: "block" }}>{formatDateTime(c.createdAt)}</Typography.Text>
                    </div>
                  </Flex>
                ))}
                {task.comments.length === 0 && <EmptyState description="No comments yet." />}
                {p.canComment ? (
                  <Flex gap={space[2]} align="flex-end">
                    <Input.TextArea value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment" maxLength={2000} autoSize={{ minRows: 2, maxRows: 6 }} />
                    <Button type="primary" icon={<SendOutlined />} onClick={postComment} loading={pending === "comment"} disabled={!comment.trim()}>
                      Post
                    </Button>
                  </Flex>
                ) : (
                  <Typography.Text type="secondary" style={textStyle.caption}>Viewers can read comments but not write them.</Typography.Text>
                )}
              </Flex>
            </Card>
          </Flex>
        </Col>

        <Col xs={24} xl={8}>
          <Flex vertical gap={space[5]}>
            <Card title={<span style={SECTION_TITLE}>Status</span>} extra={<TaskStatusPill status={task.status} />}>
              {p.canChangeStatus ? (
                <Space wrap>
                  {task.allowedTransitions.map(to => (
                    <Button key={to} size="small" onClick={() => move(to)} loading={pending === `status:${to}`} disabled={pending !== null && pending !== `status:${to}`}>
                      Move to {TASK_STATUS_LABEL[to]}
                    </Button>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary" style={textStyle.caption}>
                  Only the assignee or someone who runs this project can change the status.
                </Typography.Text>
              )}
            </Card>

            <Card title={<span style={SECTION_TITLE}>Details</span>}>
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: "assignee",
                    label: "Assignee",
                    children: p.canAssign ? (
                      <UserSelect value={task.assignee?.id ?? null} onChange={assign} disabled={pending !== null} />
                    ) : (
                      <span>
                        <PersonCell name={task.assignee?.name} size={avatarSize.sm} />
                        {task.assignee?.id === meId && <Typography.Text type="secondary"> (you)</Typography.Text>}
                      </span>
                    ),
                  },
                  { key: "priority", label: "Priority", children: <PriorityTag priority={task.priority} /> },
                  {
                    key: "due",
                    label: "Due date",
                    children: task.dueDate ? (
                      <span style={{ color: dueTextColor }}>
                        {formatDate(task.dueDate, { weekday: "short", month: "short", day: "numeric" })}
                        {due.tone !== "none" && due.tone !== "normal" ? ` · ${due.text.split(" · ")[1]}` : ""}
                      </span>
                    ) : (
                      <Typography.Text type="secondary">None</Typography.Text>
                    ),
                  },
                  { key: "project", label: "Project", children: <Link href={`/projects/${task.project.id}`}>{task.project.name}</Link> },
                ]}
              />
            </Card>

            <Card title={<span style={SECTION_TITLE}>Activity</span>}>
              {task.activity.length === 0 ? (
                <Typography.Text type="secondary">No activity recorded.</Typography.Text>
              ) : (
                <Timeline
                  items={task.activity.map(a => {
                    const s = describeActivity(a);
                    return {
                      key: a.id,
                      title: <Typography.Text type="secondary" style={textStyle.caption}>{relativeTime(a.createdAt)}</Typography.Text>,
                      content: (
                        <span style={textStyle.caption}>
                          <Typography.Text strong>{a.actor.name}</Typography.Text> {s.verb} {s.extra ?? ""}
                        </span>
                      ),
                    };
                  })}
                />
              )}
            </Card>
          </Flex>
        </Col>
      </Row>

      <Modal
        open={editOpen}
        title={`Edit ${task.key}`}
        okText="Save"
        okButtonProps={{ htmlType: "submit", loading: pending === "edit" }}
        onCancel={() => setEditOpen(false)}
        destroyOnHidden
        modalRender={dom => (
          <Form
            layout="vertical"
            requiredMark={false}
           
            initialValues={{ title: task.title, priority: task.priority, dueDate: task.dueDate ? dayjs(task.dueDate) : null, description: task.description ?? "" }}
            onFinish={saveEdit}
          >
            {dom}
          </Form>
        )}
      >
        {!p.canEditAll && (
          <Typography.Paragraph type="secondary">
            As the assignee you can change the description and due date. Title and priority belong to whoever runs the project.
          </Typography.Paragraph>
        )}
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, max: 140 }]}>
          <Input maxLength={140} disabled={!p.canEditAll} />
        </Form.Item>
        <Flex gap={space[3]}>
          <Form.Item name="priority" label="Priority" style={{ flex: 1 }}>
            <Select options={PRIORITY_OPTIONS} disabled={!p.canEditAll} />
          </Form.Item>
          <Form.Item name="dueDate" label="Due date" style={{ flex: 1 }}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Flex>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={5} maxLength={4000} />
        </Form.Item>
      </Modal>
    </main>
  );
}
