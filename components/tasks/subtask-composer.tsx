"use client";

import { DeleteOutlined, PlusOutlined, ReloadOutlined, StarOutlined } from "@ant-design/icons";
import { Alert, App, Button, Checkbox, Flex, Input, Modal, Select, Skeleton, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PRIORITY_OPTIONS } from "@/components/tasks/create-task-dialog";
import { FormError } from "@/components/ui/form-error";
import { api, errorMessage } from "@/lib/client-api";
import type { TaskPriority } from "@/lib/db/enums";
import { color, layout, space, textStyle } from "@/lib/design-system";
import type { BreakdownSuggestions } from "@/services/breakdown.service";

type Props = {
  taskId: string;
  taskKey: string;
  priority: TaskPriority;
  /** Show "Break down with AI" (needs `ai:breakdown` and a configured provider). */
  canBreakDown: boolean;
};

type Row = { id: number; include: boolean; title: string; description: string; priority: TaskPriority };

const MAX_SUBTASKS = 10;

/**
 * Adds subtasks to a task, by hand or from AI suggestions. Suggestions are only a starting
 * point: every row can be edited, unticked or removed, and nothing is saved until Create.
 */
export function SubtaskComposer({ taskId, taskKey, priority, canBreakDown }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const nextId = useRef(0);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fromAi, setFromAi] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const row = (r: Partial<Row> = {}): Row => ({ id: nextId.current++, include: true, title: "", description: "", priority, ...r });
  const update = (id: number, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const { suggestions } = await api<BreakdownSuggestions>(`/api/tasks/${taskId}/breakdown`, { method: "POST" });
      setRows(suggestions.map(s => row({ title: s.title, description: s.description, priority: s.priority })));
      setFromAi(true);
      if (suggestions.length === 0) setError("No new subtasks to suggest. Add your own below.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSuggesting(false);
    }
  }

  function openWith(ai: boolean) {
    setOpen(true);
    setError(null);
    setFromAi(false);
    setRows(ai ? [] : [row()]);
    if (ai) void suggest();
  }

  const chosen = rows.filter(r => r.include && r.title.trim());

  async function create() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        body: {
          aiAssisted: fromAi,
          subtasks: chosen.map(r => ({ title: r.title.trim(), description: r.description.trim() || null, priority: r.priority })),
        },
      });
      message.success(`Created ${chosen.length} subtask${chosen.length === 1 ? "" : "s"} under ${taskKey}`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Space size={space[2]}>
        {canBreakDown && (
          <Button size="small" icon={<StarOutlined />} onClick={() => openWith(true)}>
            Break down with AI
          </Button>
        )}
        <Button size="small" icon={<PlusOutlined />} onClick={() => openWith(false)}>
          Add subtasks
        </Button>
      </Space>

      <Modal
        open={open}
        title={fromAi || suggesting ? `Suggested subtasks for ${taskKey}` : `Add subtasks to ${taskKey}`}
        width={layout.wideModalWidth}
        onCancel={() => setOpen(false)}
        destroyOnHidden
        footer={
          <Flex justify="space-between" align="center">
            <span>
              {canBreakDown && (
                <Button icon={<ReloadOutlined />} onClick={() => void suggest()} loading={suggesting} disabled={saving}>
                  {fromAi ? "Suggest again" : "Suggest with AI"}
                </Button>
              )}
            </span>
            <Space>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="primary" onClick={() => void create()} loading={saving} disabled={chosen.length === 0 || suggesting}>
                {chosen.length ? `Create ${chosen.length} subtask${chosen.length === 1 ? "" : "s"}` : "Create"}
              </Button>
            </Space>
          </Flex>
        }
      >
        <Flex vertical gap={space[3]}>
          {fromAi && (
            <Alert
              type="info"
              showIcon
              title="Suggested by AI from the task's title and description. Edit, untick or remove anything; nothing is saved until you click Create."
            />
          )}
          <FormError message={error} />

          {suggesting ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <>
              {rows.map(r => (
                <Flex key={r.id} gap={space[2]} align="flex-start" style={{ paddingBottom: space[3], borderBottom: `1px solid ${color.neutral.borderSubtle}` }}>
                  <Checkbox checked={r.include} onChange={e => update(r.id, { include: e.target.checked })} style={{ marginTop: space[1] }} aria-label="Include" />
                  <Flex vertical gap={space[1]} style={{ flex: 1, opacity: r.include ? 1 : 0.5 }}>
                    <Flex gap={space[2]}>
                      <Input value={r.title} onChange={e => update(r.id, { title: e.target.value })} placeholder="Subtask title" maxLength={140} status={r.include && !r.title.trim() ? "warning" : undefined} />
                      <Select value={r.priority} onChange={p => update(r.id, { priority: p })} options={PRIORITY_OPTIONS} style={{ width: layout.prioritySelectWidth }} />
                    </Flex>
                    <Input.TextArea value={r.description} onChange={e => update(r.id, { description: e.target.value })} placeholder="Description (optional)" maxLength={1000} autoSize={{ minRows: 1, maxRows: 4 }} />
                  </Flex>
                  <Button type="text" icon={<DeleteOutlined />} aria-label="Remove" onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))} />
                </Flex>
              ))}
              <Flex justify="space-between" align="center">
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => setRows(rs => [...rs, row()])} disabled={rows.length >= MAX_SUBTASKS}>
                  Add a subtask
                </Button>
                <Typography.Text type="secondary" style={textStyle.caption}>
                  Up to {MAX_SUBTASKS} at a time. Assign people after creating.
                </Typography.Text>
              </Flex>
            </>
          )}
        </Flex>
      </Modal>
    </>
  );
}
