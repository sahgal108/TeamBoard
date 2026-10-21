"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ProjectStatus } from "@/generated/prisma/enums";
import { Avatar } from "@/components/ui/avatar";
import { FormError, Modal } from "@/components/ui/modal";
import { UserSelect } from "@/components/ui/user-select";
import { api, errorMessage } from "@/lib/client-api";
import { PROJECT_STATUS_LABEL } from "@/lib/labels";
import { btn, btnDanger, btnPrimary, btnSm, input, label, select, textarea } from "@/lib/ui";
import type { ProjectSummary } from "@/services/project.service";

type Perms = { canEdit: boolean; canDelete: boolean; canAssignPm: boolean; canManageMembers: boolean };
type Props = { project: ProjectSummary; permissions: Perms };

export function ProjectActions({ project, permissions }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [pmId, setPmId] = useState<string | null>(project.projectManager?.id ?? null);
  const [newMember, setNewMember] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setPending("save");
    setError(null);
    try {
      const body: Record<string, unknown> = { name, description: description || null, status };
      if (permissions.canAssignPm && pmId !== (project.projectManager?.id ?? null)) body.projectManagerId = pmId;
      await api(`/api/projects/${project.id}`, { method: "PATCH", body });
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${project.name}" and all ${project.taskCount} of its tasks? This cannot be undone.`)) return;
    setPending("delete");
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      router.push("/projects");
      router.refresh();
    } catch (err) {
      alert(errorMessage(err));
      setPending(null);
    }
  }

  async function addMember() {
    if (!newMember) return;
    setPending("add");
    setError(null);
    try {
      await api(`/api/projects/${project.id}/members`, { method: "POST", body: { userId: newMember } });
      setNewMember(null);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function removeMember(userId: string) {
    setPending(userId);
    setError(null);
    try {
      await api(`/api/projects/${project.id}/members/${userId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <button type="button" className={btn} onClick={() => setMembersOpen(true)}>Members · {project.members.length}</button>
      {permissions.canEdit && <button type="button" className={btn} onClick={() => setEditOpen(true)}>Edit</button>}
      {permissions.canDelete && <button type="button" className={btnDanger} onClick={remove} disabled={pending === "delete"}>Delete</button>}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit project">
        <form onSubmit={save} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5"><span className={label}>Name</span><input className={input} value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={80} /></label>
          <label className="flex flex-col gap-1.5"><span className={label}>Status</span>
            <select className={select} value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}>
              {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map(s => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Project manager {!permissions.canAssignPm && <span className="text-ink-3">· only company leadership can change this</span>}</span>
            <UserSelect value={pmId} onChange={setPmId} placeholder="Unassigned" disabled={!permissions.canAssignPm} />
          </label>
          <label className="flex flex-col gap-1.5"><span className={label}>Description</span><textarea className={textarea} rows={3} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} /></label>
          <FormError message={error} />
          <div className="flex justify-end gap-2.5"><button type="button" className={btn} onClick={() => setEditOpen(false)}>Cancel</button><button type="submit" className={btnPrimary} disabled={pending === "save"}>{pending === "save" ? "Saving…" : "Save"}</button></div>
        </form>
      </Modal>

      <Modal open={membersOpen} onClose={() => setMembersOpen(false)} title="Project members" description="Members can see this project and its tasks. The team's members and the project manager can see it regardless.">
        <ul className="flex flex-col">
          {project.members.map(m => (
            <li key={m.id} className="flex items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0">
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{m.name}{m.id === project.projectManager?.id && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">PM</span>}</div><div className="truncate text-xs text-ink-3">{m.email}</div></div>
              {permissions.canManageMembers && m.id !== project.projectManager?.id && (
                <button type="button" className={btnSm} onClick={() => removeMember(m.id)} disabled={pending !== null}>{pending === m.id ? "…" : "Remove"}</button>
              )}
            </li>
          ))}
          {project.members.length === 0 && <li className="py-6 text-center text-[13px] text-ink-3">No explicit members yet.</li>}
        </ul>
        {permissions.canManageMembers && (
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            <div className="flex gap-2"><UserSelect value={newMember} onChange={setNewMember} placeholder="Add a person…" exclude={project.members.map(m => m.id)} /><button type="button" className={btnPrimary} onClick={addMember} disabled={!newMember || pending !== null}>Add</button></div>
            <FormError message={error} />
          </div>
        )}
      </Modal>
    </>
  );
}
