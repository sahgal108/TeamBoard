import type { Metadata } from "next";
import type { CompanyRole } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/layout/page-header";
import { Avatar } from "@/components/ui/avatar";
import { can, type Action } from "@/lib/auth/permissions";
import { roleLabel } from "@/lib/auth/role-label";
import { requireCompanyContext } from "@/lib/page-guard";
import { card } from "@/lib/ui";
import { listCompanies } from "@/services/auth.service";

export const metadata: Metadata = { title: "Settings" };

const ROWS: { label: string; action: Action; facts?: Parameters<typeof can>[2]; note?: string }[] = [
  { label: "Create teams and projects", action: "project:create" },
  { label: "Assign project managers", action: "project:assign_pm" },
  { label: "Edit a project you manage", action: "project:update", facts: { isProjectManager: true } },
  { label: "Edit a project on your team", action: "project:update", facts: { isTeamMember: true } },
  { label: "Create tasks in a project you manage", action: "task:create", facts: { isProjectManager: true } },
  { label: "Change status of a task assigned to you", action: "task:update_status", facts: { isAssignee: true, isProjectMember: true } },
  { label: "Comment on a project you are part of", action: "comment:create", facts: { isProjectMember: true } },
  { label: "See company-wide activity", action: "activity:read_company" },
];

export default async function SettingsPage() {
  const ctx = await requireCompanyContext();
  const companies = await listCompanies(ctx.user.id);
  const role = ctx.membership.role as CompanyRole;

  return (
    <main className="flex flex-1 flex-col gap-5 p-7">
      <PageHeader title="Settings" subtitle="Your account, your companies, and what your role lets you do here." />
      <div className="grid max-w-[960px] gap-5 xl:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className="mb-4 text-sm font-semibold">Account</h2>
          <div className="flex items-center gap-3">
            <Avatar name={ctx.user.name} size={44} />
            <div><div className="font-medium">{ctx.user.name}</div><div className="text-[13px] text-ink-2">{ctx.user.email}</div></div>
          </div>
          <h3 className="mt-6 mb-2 text-xs uppercase tracking-[0.06em] text-ink-3">Companies</h3>
          <ul className="flex flex-col divide-y divide-line-2 text-[13px]">
            {companies.map(c => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="font-medium">{c.name}{c.id === ctx.company.id && <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">active</span>}</span>
                <span className="text-ink-2">{roleLabel(c.role)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={`${card} p-5`}>
          <h2 className="mb-1 text-sm font-semibold">Your permissions in {ctx.company.name}</h2>
          <p className="mb-4 text-[13px] text-ink-2">Role: {roleLabel(role)}. Every request is checked against this on the server; the interface only hides what you cannot do.</p>
          <ul className="flex flex-col divide-y divide-line-2 text-[13px]">
            {ROWS.map(r => {
              const ok = can(ctx, r.action, r.facts);
              return (
                <li key={r.label} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-ink-2">{r.label}</span>
                  <span className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${ok ? "bg-accent-soft text-accent" : "bg-line-2 text-ink-3"}`}>{ok ? "Allowed" : "Not allowed"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
