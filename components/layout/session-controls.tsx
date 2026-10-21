"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CompanySummary } from "@/services/auth.service";

type Props = { companies: CompanySummary[]; activeCompanyId: string; roleLabel: string };

/** Company switcher (only when the user belongs to more than one) and sign-out. */
export function CompanySwitcher({ companies, activeCompanyId, roleLabel }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const active = companies.find(c => c.id === activeCompanyId);

  async function switchTo(companyId: string) {
    if (companyId === activeCompanyId) return;
    setPending(true);
    try {
      const res = await fetch("/api/auth/switch-company", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#22332d] bg-side-active px-3 py-2.5">
      <div className="min-w-0">
        {companies.length > 1 ? (
          <select
            aria-label="Switch company"
            value={activeCompanyId}
            disabled={pending}
            onChange={e => switchTo(e.target.value)}
            className="w-full cursor-pointer appearance-none bg-transparent text-[13px] font-medium text-white outline-none"
          >
            {companies.map(c => (
              <option key={c.id} value={c.id} className="text-ink">
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="truncate text-[13px] font-medium text-white">{active?.name}</div>
        )}
        <div className="text-[11px] text-side-muted">{roleLabel}</div>
      </div>
      {companies.length > 1 && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-side-muted" aria-hidden="true">
          <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
        </svg>
      )}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      title="Sign out"
      className="grid size-8 shrink-0 place-items-center rounded-md text-side-muted transition-colors hover:bg-side-active hover:text-white disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
      </svg>
      <span className="sr-only">Sign out</span>
    </button>
  );
}
