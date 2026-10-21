import type { CompanyContext } from "@/lib/auth/get-company-context";
import type { CompanySummary } from "@/services/auth.service";
import { roleLabel } from "@/lib/auth/role-label";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { CompanySwitcher, SignOutButton } from "./session-controls";
import { WordmarkIcon } from "./wordmark-icon";

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  { key: "teams", label: "Teams", href: "/teams" },
  { key: "projects", label: "Projects", href: "/projects" },
  { key: "tasks", label: "Tasks", href: "/tasks" },
  { key: "activity", label: "Activity", href: "/activity" },
];
const WORKSPACE_NAV: NavItem[] = [{ key: "settings", label: "Settings", href: "/settings" }];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({ ctx, companies }: { ctx: CompanyContext; companies: CompanySummary[] }) {
  const role = ctx.membership.role;
  const scoped = role === "MEMBER" || role === "VIEWER" || role === "PROJECT_MANAGER";
  const nav = NAV.map(i => (i.key === "tasks" && scoped ? { ...i, label: "My tasks" } : i));

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-4.5 bg-side px-3.5 py-5 text-side-ink">
      <div className="flex items-center gap-2.5 px-2 text-white">
        <span className="grid size-[26px] place-items-center rounded-[7px] bg-accent">
          <WordmarkIcon size={15} />
        </span>
        <span className="font-display text-[17px] font-bold">TeamBoard</span>
      </div>

      <CompanySwitcher companies={companies} activeCompanyId={ctx.company.id} roleLabel={roleLabel(role)} />

      <SidebarNav items={nav} />
      <div className="px-3 pt-2 text-[11px] uppercase tracking-[0.08em] text-side-muted">Workspace</div>
      <SidebarNav items={WORKSPACE_NAV} />

      <div className="mt-auto flex items-center gap-2.5 border-t border-[#22332d] px-3 pt-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white">
          {initials(ctx.user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white">{ctx.user.name}</div>
          <div className="truncate text-[11.5px] text-side-muted">{ctx.user.email}</div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
