"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FormError } from "@/components/ui/modal";
import { UserSelect } from "@/components/ui/user-select";
import { api, errorMessage } from "@/lib/client-api";
import { btnPrimary, btnSm, card } from "@/lib/ui";

type Member = { id: string; name: string; email: string; role: string };
type Props = { teamId: string; members: Member[]; canManage: boolean };

export function TeamMembersPanel({ teamId, members, canManage }: Props) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function add() {
    if (!userId) return;
    setPending("add");
    setError(null);
    try {
      await api(`/api/teams/${teamId}/members`, { method: "POST", body: { userId } });
      setUserId(null);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function remove(id: string) {
    setPending(id);
    setError(null);
    try {
      await api(`/api/teams/${teamId}/members/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className={`${card} flex flex-col overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
        <h2 className="text-sm font-semibold">Members</h2>
        <span className="text-[13px] text-ink-3">{members.length}</span>
      </div>
      <ul className="flex flex-col">
        {members.map(m => (
          <li key={m.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 last:border-b-0">
            <Avatar name={m.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{m.name}</div>
              <div className="truncate text-xs text-ink-3">{m.role.replace(/_/g, " ").toLowerCase()} · {m.email}</div>
            </div>
            {canManage && (
              <button type="button" className={btnSm} onClick={() => remove(m.id)} disabled={pending !== null}>
                {pending === m.id ? "…" : "Remove"}
              </button>
            )}
          </li>
        ))}
        {members.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-ink-3">No members yet.</li>}
      </ul>
      {canManage && (
        <div className="mt-auto flex flex-col gap-2 border-t border-line px-4 py-3">
          <div className="flex gap-2">
            <UserSelect value={userId} onChange={setUserId} placeholder="Add a person…" exclude={members.map(m => m.id)} />
            <button type="button" className={btnPrimary} onClick={add} disabled={!userId || pending !== null}>Add</button>
          </div>
          <FormError message={error} />
        </div>
      )}
    </section>
  );
}
