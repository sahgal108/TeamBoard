"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormError, Modal } from "@/components/ui/modal";
import { UserSelect } from "@/components/ui/user-select";
import { api, errorMessage } from "@/lib/client-api";
import { btn, btnPrimary, input, label, select, textarea } from "@/lib/ui";

type Props = { teams: { id: string; name: string }[] };

/** "Payment Service" → "PAY". Editable afterwards. */
function suggestKey(name: string) {
  const words = name.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 4);
  return words.map(w => w[0]).join("").slice(0, 6);
}

export function CreateProjectDialog({ teams }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [pmId, setPmId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const project = await api<{ id: string }>("/api/projects", { method: "POST", body: { name, key, teamId, projectManagerId: pmId, description: description || null } });
      setOpen(false);
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)} disabled={teams.length === 0} title={teams.length === 0 ? "Create a team first" : undefined}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        New project
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New project" description="Projects belong to a team. The key prefixes every task, e.g. PAY-14.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <label className="flex flex-col gap-1.5"><span className={label}>Name</span><input className={input} value={name} onChange={e => { setName(e.target.value); if (!keyTouched) setKey(suggestKey(e.target.value)); }} required minLength={2} maxLength={80} autoFocus /></label>
            <label className="flex flex-col gap-1.5"><span className={label}>Key</span><input className={`${input} font-mono uppercase`} value={key} onChange={e => { setKeyTouched(true); setKey(e.target.value.toUpperCase()); }} required pattern="[A-Za-z][A-Za-z0-9]{1,5}" maxLength={6} /></label>
          </div>
          <label className="flex flex-col gap-1.5"><span className={label}>Team</span>
            <select className={select} value={teamId} onChange={e => setTeamId(e.target.value)} required>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5"><span className={label}>Project manager <span className="text-ink-3">(optional)</span></span><UserSelect value={pmId} onChange={setPmId} placeholder="Decide later" /></label>
          <label className="flex flex-col gap-1.5"><span className={label}>Description <span className="text-ink-3">(optional)</span></span><textarea className={textarea} rows={2} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} /></label>
          <FormError message={error} />
          <div className="flex justify-end gap-2.5"><button type="button" className={btn} onClick={() => setOpen(false)}>Cancel</button><button type="submit" className={btnPrimary} disabled={pending || !teamId || name.trim().length < 2 || key.length < 2}>{pending ? "Creating…" : "Create project"}</button></div>
        </form>
      </Modal>
    </>
  );
}
