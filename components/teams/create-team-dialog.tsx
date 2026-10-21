"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormError, Modal } from "@/components/ui/modal";
import { api, errorMessage } from "@/lib/client-api";
import { btn, btnPrimary, input, label, textarea } from "@/lib/ui";

export function CreateTeamDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const team = await api<{ id: string }>("/api/teams", { method: "POST", body: { name, description: description || null } });
      setOpen(false);
      router.push(`/teams/${team.id}`);
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
        New team
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New team" description="A team owns projects. Only company leadership can create one.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5"><span className={label}>Name</span><input className={input} value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={60} autoFocus /></label>
          <label className="flex flex-col gap-1.5"><span className={label}>Description <span className="text-ink-3">(optional)</span></span><textarea className={textarea} rows={2} value={description} onChange={e => setDescription(e.target.value)} maxLength={300} /></label>
          <FormError message={error} />
          <div className="flex justify-end gap-2.5"><button type="button" className={btn} onClick={() => setOpen(false)}>Cancel</button><button type="submit" className={btnPrimary} disabled={pending || name.trim().length < 2}>{pending ? "Creating…" : "Create team"}</button></div>
        </form>
      </Modal>
    </>
  );
}
