"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { TaskPriority } from "@/generated/prisma/enums";
import { FormError, Modal } from "@/components/ui/modal";
import { UserSelect } from "@/components/ui/user-select";
import { api, errorMessage } from "@/lib/client-api";
import { PRIORITY_LABEL } from "@/lib/labels";
import { btn, btnPrimary, input, label, select, textarea } from "@/lib/ui";

type Props = { projectId: string; projectKey: string; canAssign: boolean };

export function CreateTaskDialog({ projectId, projectKey, canAssign }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setTitle(""); setDescription(""); setPriority("MEDIUM"); setAssigneeId(null); setDueDate(""); setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/api/tasks", { method: "POST", body: { projectId, title, description: description || null, priority, assigneeId: canAssign ? assigneeId : null, dueDate: dueDate || null } });
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        New task
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New task" description={`Gets the next ${projectKey} number automatically.`}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5"><span className={label}>Title</span><input className={input} value={title} onChange={e => setTitle(e.target.value)} required maxLength={140} autoFocus /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5"><span className={label}>Priority</span>
              <select className={select} value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
                {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5"><span className={label}>Due date</span><input type="date" className={input} value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
          </div>
          {canAssign && <label className="flex flex-col gap-1.5"><span className={label}>Assignee</span><UserSelect value={assigneeId} onChange={setAssigneeId} /></label>}
          <label className="flex flex-col gap-1.5"><span className={label}>Description <span className="text-ink-3">(optional)</span></span><textarea className={textarea} rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} /></label>
          <FormError message={error} />
          <div className="flex justify-end gap-2.5"><button type="button" className={btn} onClick={() => setOpen(false)}>Cancel</button><button type="submit" className={btnPrimary} disabled={pending || title.trim().length === 0}>{pending ? "Creating…" : "Create task"}</button></div>
        </form>
      </Modal>
    </>
  );
}
