"use client";

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Alert, Avatar as AntAvatar, Badge, Card, Col, Flex, Row, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { TaskStatus } from "@/lib/db/enums";
import { Avatar } from "@/components/ui/avatar";
import { KeyTag, PriorityTag, TASK_STATUS_HEX } from "@/components/ui/badges";
import { useProjectRealtime } from "@/hooks/use-project-realtime";
import { avatarSize, color, font, layout, space, textStyle } from "@/lib/design-system";
import { api, errorMessage } from "@/lib/client-api";
import { dueColor, dueLabel } from "@/lib/format";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER } from "@/lib/labels";
import { canTransition } from "@/lib/task-transitions";
import type { TaskListItem } from "@/services/task.service";

type Props = { projectId: string; tasks: TaskListItem[]; meId: string; canManage: boolean; isViewer: boolean };


function TaskCard({ task, draggable, dragging = false }: { task: TaskListItem; draggable: boolean; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !draggable });
  const due = dueLabel(task.dueDate, task.status);
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={`${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging && !dragging ? "opacity-40" : ""} ${dragging ? "rotate-1" : ""}`}
    >
      <Card size="small" hoverable={draggable} styles={{ body: { display: "flex", flexDirection: "column", gap: space[2] } }}>
        <Link href={`/tasks/${task.id}`} className="text-base font-medium leading-snug text-ink hover:text-accent" onPointerDown={e => e.stopPropagation()}>
          {task.title}
        </Link>
        <Flex align="center" gap={space[2]} wrap>
          <KeyTag>{task.key}</KeyTag>
          <PriorityTag priority={task.priority} />
          {task.dueDate && (
            <Typography.Text style={{ ...textStyle.caption, color: dueColor(due.tone) }} type={dueColor(due.tone) ? undefined : "secondary"}>
              {due.text}
            </Typography.Text>
          )}
          <span style={{ marginLeft: "auto" }}>
            {task.assignee ? <Avatar name={task.assignee.name} size={avatarSize.sm} /> : <AntAvatar size={avatarSize.sm} style={{ background: "transparent", border: `1px dashed ${color.neutral.border}`, color: color.neutral.textMuted, fontSize: font.size.xs }}>—</AntAvatar>}
          </span>
        </Flex>
      </Card>
    </div>
  );
}

function Column({ status, tasks, meId, canManage, isViewer }: { status: TaskStatus; tasks: TaskListItem[]; meId: string; canManage: boolean; isViewer: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-2 rounded-lg p-1.5 transition-colors"
      style={{ minHeight: layout.boardColumnMinHeight, background: isOver ? color.brand.primarySoft : undefined }}
    >
      <Flex align="center" gap={space[2]} style={{ padding: `${space[1]}px ${space[1.5]}px` }}>
        <Badge color={TASK_STATUS_HEX[status]} text={<Typography.Text strong type="secondary" style={textStyle.columnLabel}>{TASK_STATUS_LABEL[status]}</Typography.Text>} />
        <Badge count={tasks.length} showZero color={color.neutral.borderSubtle} style={{ color: color.neutral.textSecondary, marginLeft: "auto" }} />
      </Flex>
      {tasks.map(t => (
        <TaskCard key={t.id} task={t} draggable={!isViewer && (canManage || t.assignee?.id === meId)} />
      ))}
    </div>
  );
}

export function KanbanBoard({ projectId, tasks: serverTasks, meId, canManage, isViewer }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(serverTasks);
  const [seenServerTasks, setSeenServerTasks] = useState(serverTasks);
  const [active, setActive] = useState<TaskListItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Server re-render (after our own refresh or someone else's change) wins over local state.
  // Derived-state pattern: adjust during render when the prop identity changes.
  if (seenServerTasks !== serverTasks) {
    setSeenServerTasks(serverTasks);
    setTasks(serverTasks);
  }

  // Another user changed something in this project: pull fresh data.
  const onRemote = useCallback(
    (event: { actorId?: string }) => {
      if (event.actorId !== meId) router.refresh();
    },
    [meId, router],
  );
  const { connected } = useProjectRealtime(projectId, onRemote);

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskListItem[]> = { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  function onDragStart(e: DragStartEvent) {
    setActive(tasks.find(t => t.id === e.active.id) ?? null);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const task = tasks.find(t => t.id === e.active.id);
    const to = e.over?.id as TaskStatus | undefined;
    if (!task || !to || to === task.status) return;
    if (!canTransition(task.status, to)) {
      setNotice(`${task.key} can't go from ${TASK_STATUS_LABEL[task.status]} straight to ${TASK_STATUS_LABEL[to]}.`);
      return;
    }
    const previous = tasks;
    setNotice(null);
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: to } : t)));
    try {
      await api(`/api/tasks/${task.id}/status`, { method: "PATCH", body: { status: to } });
      router.refresh();
    } catch (err) {
      setTasks(previous);
      setNotice(errorMessage(err));
    }
  }

  return (
    <Flex vertical gap={space[3]} style={{ flex: 1, minHeight: 0 }}>
      {(notice || connected) && (
        <Flex align="center" gap={space[3]}>
          {notice && <Alert type="warning" showIcon title={notice} closable={{ onClose: () => setNotice(null) }} />}
          {connected && <Badge status="processing" text="Live updates on" style={{ marginLeft: "auto" }} />}
        </Flex>
      )}
      <DndContext id={`board-${projectId}`} sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <Row gutter={space[4]} style={{ flex: 1 }}>
          {TASK_STATUS_ORDER.map(s => (
            <Col key={s} xs={24} md={12} xl={6}>
              <Column status={s} tasks={byStatus[s]} meId={meId} canManage={canManage} isViewer={isViewer} />
            </Col>
          ))}
        </Row>
        <DragOverlay>{active ? <TaskCard task={active} draggable dragging /> : null}</DragOverlay>
      </DndContext>
    </Flex>
  );
}
