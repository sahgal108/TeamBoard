"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { KeyTag, PriorityTag, TaskStatusPill } from "@/components/ui/badges";
import { FormError, Modal } from "@/components/ui/modal";
import { UserSelect } from "@/components/ui/user-select";
import { describeActivity } from "@/lib/activity-text";
import { api, errorMessage } from "@/lib/client-api";
import { dueLabel, formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/labels";
import { btn, btnDanger, btnPrimary, btnSm, card, input, label, select, textarea } from "@/lib/ui";
import type { getTask } from "@/services/task.service";

type Task = Awaited<ReturnType<typeof getTask>>;
type Props = { task: Task; meId: string };

export function TaskDetail({ task, meId }: Props) {
  const router = useRouter();
  const p = task.permissions;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
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
  const remove = () => {
    if (!confirm(`Delete ${task.key} "${task.title}"?`)) return;
    void run("delete", () => api(`/api/tasks/${task.id}`, { method: "DELETE" }), () => router.push(`/projects/${task.project.id}`));
  };
  const saveEdit = (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { description: description || null, dueDate: dueDate || null };
    if (p.canEditAll) Object.assign(body, { title, priority });
    void run("edit", () => api(`/api/tasks/${task.id}`, { method: "PATCH", body }), () => setEditOpen(false));
  };
  const postComment = (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    void run("comment", () => api(`/api/tasks/${task.id}/comments`, { method: "POST", body: { content: comment } }), () => setComment(""));
  };

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader
        crumbs={[{ label: "Projects", href: "/projects" }, { label: task.project.name, href: `/projects/${task.project.id}` }, { label: task.key }]}
        title={task.title}
        subtitle={<span className="flex flex-wrap items-center gap-3"><KeyTag>{task.key}</KeyTag><TaskStatusPill status={task.status} /><PriorityTag priority={task.priority} /><span className="text-ink-3">Created by {task.createdBy.name} · {formatDate(task.createdAt)}</span></span>}
        actions={
          <>
            {p.canEdit && <button type="button" className={btn} onClick={() => setEditOpen(true)}>Edit</button>}
            {p.canDelete && <button type="button" className={btnDanger} onClick={remove} disabled={pending === "delete"}>Delete</button>}
          </>
        }
      />
      <FormError message={error} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          <section className={`${card} p-5`}>
            <h2 className="mb-2 text-xs uppercase tracking-[0.06em] text-ink-3">Description</h2>
            {task.description ? <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">{task.description}</p> : <p className="text-[13.5px] text-ink-3">No description yet.</p>}
          </section>

          <section className={`${card} p-5`}>
            <h2 className="mb-3 text-xs uppercase tracking-[0.06em] text-ink-3">Comments · {task.comments.length}</h2>
            <div className="flex flex-col">
              {task.comments.map(c => (
                <div key={c.id} className="flex gap-3 py-2.5">
                  <Avatar name={c.author.name} />
                  <div className="min-w-0"><div className="text-[13px] leading-relaxed"><span className="font-medium">{c.author.name}</span> <span className="text-ink-2">{c.content}</span></div><div className="text-xs text-ink-3">{formatDateTime(c.createdAt)}</div></div>
                </div>
              ))}
              {task.comments.length === 0 && <p className="py-2 text-[13px] text-ink-3">No comments yet.</p>}
            </div>
            {p.canComment ? (
              <form onSubmit={postComment} className="mt-3 flex gap-2.5">
                <textarea className={textarea} rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment" maxLength={2000} />
                <button type="submit" className={`${btnPrimary} self-end`} disabled={pending === "comment" || !comment.trim()}>{pending === "comment" ? "…" : "Post"}</button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-ink-3">Viewers can read comments but not write them.</p>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className={`${card} flex flex-col gap-3 p-5`}>
            <h2 className="text-xs uppercase tracking-[0.06em] text-ink-3">Status</h2>
            <TaskStatusPill status={task.status} />
            {p.canChangeStatus ? (
              <div className="flex flex-wrap gap-2">
                {task.allowedTransitions.map(to => (
                  <button key={to} type="button" className={btnSm} onClick={() => move(to)} disabled={pending !== null}>
                    {pending === `status:${to}` ? "…" : `Move to ${TASK_STATUS_LABEL[to]}`}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-3">Only the assignee or someone who runs this project can change the status.</p>
            )}
          </section>

          <section className={`${card} flex flex-col gap-3 p-5`}>
            <h2 className="text-xs uppercase tracking-[0.06em] text-ink-3">Details</h2>
            <dl className="grid grid-cols-[100px_1fr] items-center gap-y-3 text-[13px]">
              <dt className="text-ink-3">Assignee</dt>
              <dd>
                {p.canAssign ? (
                  <UserSelect value={task.assignee?.id ?? null} onChange={assign} disabled={pending !== null} />
                ) : task.assignee ? (
                  <span className="flex items-center gap-2"><Avatar name={task.assignee.name} size={22} />{task.assignee.name}{task.assignee.id === meId && <span className="text-ink-3">(you)</span>}</span>
                ) : (
                  <span className="text-ink-3">Unassigned</span>
                )}
              </dd>
              <dt className="text-ink-3">Priority</dt><dd><PriorityTag priority={task.priority} /></dd>
              <dt className="text-ink-3">Due date</dt>
              <dd className={due.tone === "overdue" ? "text-priority-urgent" : due.tone === "soon" ? "text-status-review" : ""}>{task.dueDate ? formatDate(task.dueDate, { weekday: "short", month: "short", day: "numeric" }) : <span className="text-ink-3">None</span>}{task.dueDate && due.tone !== "none" && due.tone !== "normal" ? ` · ${due.text.split(" · ")[1]}` : ""}</dd>
              <dt className="text-ink-3">Project</dt><dd><Link href={`/projects/${task.project.id}`} className="hover:text-accent">{task.project.name}</Link></dd>
            </dl>
          </section>

          <section className={`${card} p-5`}>
            <h2 className="mb-3 text-xs uppercase tracking-[0.06em] text-ink-3">Activity</h2>
            <ul className="flex flex-col gap-2 text-[12.5px] text-ink-2">
              {task.activity.map(a => {
                const s = describeActivity(a);
                return (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="w-16 shrink-0 font-mono text-[11.5px] text-ink-3">{relativeTime(a.createdAt)}</span>
                    <span><span className="font-medium text-ink">{a.actor.name}</span> {s.verb} {s.extra ?? ""}</span>
                  </li>
                );
              })}
              {task.activity.length === 0 && <li className="text-ink-3">No activity recorded.</li>}
            </ul>
          </section>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${task.key}`} description={p.canEditAll ? undefined : "As the assignee you can change the description and due date. Title and priority belong to whoever runs the project."}>
        <form onSubmit={saveEdit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5"><span className={label}>Title</span><input className={input} value={title} onChange={e => setTitle(e.target.value)} disabled={!p.canEditAll} required maxLength={140} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5"><span className={label}>Priority</span>
              <select className={select} value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} disabled={!p.canEditAll}>
                {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map(pr => <option key={pr} value={pr}>{PRIORITY_LABEL[pr]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5"><span className={label}>Due date</span><input type="date" className={input} value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
          </div>
          <label className="flex flex-col gap-1.5"><span className={label}>Description</span><textarea className={textarea} rows={5} value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} /></label>
          <div className="flex justify-end gap-2.5"><button type="button" className={btn} onClick={() => setEditOpen(false)}>Cancel</button><button type="submit" className={btnPrimary} disabled={pending === "edit"}>{pending === "edit" ? "Saving…" : "Save"}</button></div>
        </form>
      </Modal>
    </main>
  );
}
