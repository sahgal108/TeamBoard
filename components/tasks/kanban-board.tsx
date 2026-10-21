"use client";

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { TaskStatus } from "@/generated/prisma/enums";
import { Avatar } from "@/components/ui/avatar";
import { KeyTag, PriorityTag } from "@/components/ui/badges";
import { useProjectRealtime } from "@/hooks/use-project-realtime";
import { api, errorMessage } from "@/lib/client-api";
import { dueLabel } from "@/lib/format";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER } from "@/lib/labels";
import { canTransition } from "@/lib/task-transitions";
import type { TaskListItem } from "@/services/task.service";

type Props = { projectId: string; tasks: TaskListItem[]; meId: string; canManage: boolean; isViewer: boolean };

const COLUMN_DOT: Record<TaskStatus, string> = { TODO: "bg-status-todo", IN_PROGRESS: "bg-status-progress", IN_REVIEW: "bg-status-review", DONE: "bg-status-done" };

function TaskCard({ task, draggable, dragging = false }: { task: TaskListItem; draggable: boolean; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !draggable });
  const due = dueLabel(task.dueDate, task.status);
  return (
    <div
      ref={setNodeRef}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={`flex flex-col gap-2.5 rounded-card border border-line bg-surface px-3.5 py-3 shadow-[0_1px_2px_rgba(23,33,29,.04)] ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging && !dragging ? "opacity-40" : ""} ${dragging ? "rotate-1 shadow-lg" : ""}`}
    >
      <Link href={`/tasks/${task.id}`} className="text-[13.5px] font-medium leading-snug hover:text-accent" onPointerDown={e => e.stopPropagation()}>
        {task.title}
      </Link>
      <div className="flex items-center gap-2 text-xs text-ink-3">
        <KeyTag>{task.key}</KeyTag>
        <PriorityTag priority={task.priority} />
        <span className={due.tone === "overdue" ? "text-priority-urgent" : due.tone === "soon" ? "text-status-review" : ""}>{due.tone === "none" && !task.dueDate ? "" : due.text}</span>
        <span className="ml-auto">{task.assignee ? <Avatar name={task.assignee.name} size={22} /> : <span className="grid size-[22px] place-items-center rounded-full border border-dashed border-line text-[9px]">—</span>}</span>
      </div>
    </div>
  );
}

function Column({ status, tasks, meId, canManage, isViewer }: { status: TaskStatus; tasks: TaskListItem[]; meId: string; canManage: boolean; isViewer: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex min-h-[200px] flex-col gap-2.5 rounded-xl p-1.5 transition-colors ${isOver ? "bg-accent-soft/60" : ""}`}>
      <div className="flex items-center gap-2 px-1.5 py-1 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink-2">
        <i className={`size-2 rounded-full ${COLUMN_DOT[status]}`} />
        {TASK_STATUS_LABEL[status]}
        <span className="ml-auto font-mono text-xs font-medium text-ink-3">{tasks.length}</span>
      </div>
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {(notice || connected) && (
        <div className="flex items-center gap-3 text-xs">
          {notice && <span role="alert" className="rounded-md bg-[#fdf1df] px-2.5 py-1.5 text-status-review">{notice}</span>}
          {connected && <span className="ml-auto inline-flex items-center gap-1.5 text-ink-3"><i className="size-1.5 rounded-full bg-accent" />Live updates on</span>}
        </div>
      )}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div className="grid flex-1 grid-cols-2 gap-4 xl:grid-cols-4">
          {TASK_STATUS_ORDER.map(s => (
            <Column key={s} status={s} tasks={byStatus[s]} meId={meId} canManage={canManage} isViewer={isViewer} />
          ))}
        </div>
        <DragOverlay>{active ? <TaskCard task={active} draggable dragging /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
