import type { CompanyRole } from "@/generated/prisma/enums";
import type { CompanyContext } from "./get-company-context";

/**
 * Every permission the app checks. Naming: `<resource>:<verb>`.
 */
export type Action =
  | "team:read"
  | "team:create"
  | "team:update"
  | "team:delete"
  | "team:manage_members"
  | "project:read"
  | "project:create"
  | "project:update"
  | "project:delete"
  | "project:assign_pm"
  | "project:manage_members"
  | "task:read"
  | "task:create"
  | "task:assign"
  | "task:update_status"
  | "task:edit"
  | "task:delete"
  | "comment:create"
  | "activity:read_company";

/** Facts about the caller's relationship to the resource. Loaded by lib/authorization/*, never here. */
export type Facts = {
  /** caller belongs to the team (for a project: the project's team) */
  isTeamMember?: boolean;
  /** caller is an explicit ProjectMember */
  isProjectMember?: boolean;
  /** caller is the project's projectManagerId */
  isProjectManager?: boolean;
  /** caller is the task's assignee */
  isAssignee?: boolean;
};

/** Only the role matters to policy; a full CompanyContext satisfies this. */
export type PolicyContext = { membership: Pick<CompanyContext["membership"], "role"> };

/** Company-wide roles that see and may change everything inside their company. */
export const FULL_ACCESS_ROLES: ReadonlySet<CompanyRole> = new Set<CompanyRole>(["CEO", "TECH_LEAD"]);

export function hasFullAccess(role: CompanyRole): boolean {
  return FULL_ACCESS_ROLES.has(role);
}

/** Can the caller see this project (or a task inside it) at all? */
function canSee(f: Facts): boolean {
  return Boolean(f.isProjectManager || f.isTeamMember || f.isProjectMember);
}

/** Does the caller run this project: PM of it, or a Team Lead on its team? */
function manages(role: CompanyRole, f: Facts): boolean {
  if (role === "PROJECT_MANAGER") return Boolean(f.isProjectManager);
  if (role === "TEAM_LEAD") return Boolean(f.isTeamMember);
  return false;
}

/**
 * Pure policy. No I/O, no Prisma, no async. Given the caller's company role and the loaded
 * facts, answers yes/no. Cross-tenant access never reaches this function: loaders return 404
 * before any policy question is asked.
 */
export function can(ctx: PolicyContext, action: Action, facts: Facts = {}): boolean {
  const role = ctx.membership.role;
  const full = hasFullAccess(role);

  switch (action) {
    // Teams are the org chart: every company member may read them.
    case "team:read":
      return true;
    case "team:create":
    case "team:delete":
      return full;
    case "team:update":
    case "team:manage_members":
      return full || (role === "TEAM_LEAD" && Boolean(facts.isTeamMember));

    case "project:read":
    case "task:read":
      return full || canSee(facts);
    case "project:create":
    case "project:assign_pm":
    case "project:delete":
      return full;
    case "project:update":
    case "project:manage_members":
    case "task:create":
    case "task:assign":
      return full || manages(role, facts);

    // Whoever runs the project, plus the person the task is assigned to. Viewers never.
    case "task:update_status":
    case "task:edit":
      if (role === "VIEWER") return false;
      return full || manages(role, facts) || Boolean(facts.isAssignee);
    case "task:delete":
      return full || (role === "PROJECT_MANAGER" && Boolean(facts.isProjectManager));

    case "comment:create":
      if (role === "VIEWER") return false;
      return full || canSee(facts);

    case "activity:read_company":
      return full;
  }
}
