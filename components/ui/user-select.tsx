"use client";

import { Select } from "antd";
import { useEffect, useState, type CSSProperties } from "react";
import { api } from "@/lib/client-api";
import type { CompanyUser } from "@/lib/authorization/company-users";
import { Avatar } from "./avatar";
import { avatarSize } from "@/lib/design-system";

type Props = {
  value?: string | null;
  onChange?: (userId: string | null) => void;
  placeholder?: string;
  exclude?: string[];
  disabled?: boolean;
  id?: string;
  style?: CSSProperties;
};

/** Company-scoped people picker backed by GET /api/users. Works standalone or inside a Form.Item. */
export function UserSelect({ value, onChange, placeholder = "Unassigned", exclude = [], disabled, id, style }: Props) {
  const [users, setUsers] = useState<CompanyUser[] | null>(null);

  useEffect(() => {
    let alive = true;
    api<CompanyUser[]>("/api/users").then(u => alive && setUsers(u)).catch(() => alive && setUsers([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Select
      id={id}
      showSearch={{ optionFilterProp: "search" }}
      allowClear
      loading={users === null}
      disabled={disabled || users === null}
      placeholder={users === null ? "Loading…" : placeholder}
      value={value ?? undefined}
      onChange={v => onChange?.(v ?? null)}
      style={{ width: "100%", ...style }}
      options={users
        ?.filter(u => !exclude.includes(u.id))
        .map(u => ({
          value: u.id,
          search: `${u.name} ${u.role}`,
          label: (
            <span className="inline-flex items-center gap-2">
              <Avatar name={u.name} size={avatarSize.xs} />
              {u.name}
              <span className="text-ink-3">· {u.role.replace(/_/g, " ").toLowerCase()}</span>
            </span>
          ),
        }))}
    />
  );
}
