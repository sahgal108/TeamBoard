"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormError, Modal } from "@/components/ui/modal";
import { api, errorMessage } from "@/lib/client-api";
import { btn, btnDanger, btnPrimary, input, label, textarea } from "@/lib/ui";

type Props = { team: { id: string; name: string; description: string | null }; canEdit: boolean; canDelete: boolean; hasProjects: boolean };

export function TeamActions({ team, canEdit, canDelete, hasProjects }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canEdit && !canDelete) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(`/api/teams/${team.id}`, { method: "PATCH", body: { name, description: description || null } });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
    setPending(true);
    try {
      await api(`/api/teams/${team.id}`, { method: "DELETE" });
      router.push("/teams");
      router.refresh();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {canEdit && <button type="button" className={btn} onClick={() => setOpen(true)}>Edit team</button>}
      {canDelete && (
        <button type="button" className={btnDanger} onClick={remove} disabled={pending || hasProjects} title={hasProjects ? "Move or delete this team's projects first" : undefined}>
          Delete
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Edit team">
        <form onSubmit={save} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5"><span className={label}>Name</span><input className={input} value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={60} /></label>
          <label className="flex flex-col gap-1.5"><span className={label}>Description</span><textarea className={textarea} rows={2} value={description} onChange={e => setDescription(e.target.value)} maxLength={300} /></label>
          <FormError message={error} />
          <div className="flex justify-end gap-2.5"><button type="button" className={btn} onClick={() => setOpen(false)}>Cancel</button><button type="submit" className={btnPrimary} disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
        </form>
      </Modal>
    </>
  );
}
