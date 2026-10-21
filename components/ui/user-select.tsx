"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { select } from "@/lib/ui";
import type { CompanyUser } from "@/lib/authorization/company-users";

type Props = {
  value: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  exclude?: string[];
  disabled?: boolean;
  id?: string;
};

/** Company-scoped people picker backed by GET /api/users. */
export function UserSelect({ value, onChange, placeholder = "Unassigned", exclude = [], disabled, id }: Props) {
  const [users, setUsers] = useState<CompanyUser[] | null>(null);

  useEffect(() => {
    let alive = true;
    api<CompanyUser[]>("/api/users").then(u => alive && setUsers(u)).catch(() => alive && setUsers([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <select id={id} className={select} value={value ?? ""} onChange={e => onChange(e.target.value || null)} disabled={disabled || users === null}>
      <option value="">{users === null ? "Loading…" : placeholder}</option>
      {users
        ?.filter(u => !exclude.includes(u.id))
        .map(u => (
          <option key={u.id} value={u.id}>
            {u.name} · {u.role.replace(/_/g, " ").toLowerCase()}
          </option>
        ))}
    </select>
  );
}
