import { describe, expect, it } from "vitest";
import { can, type Action, type Facts } from "@/lib/auth/permissions";
import type { CompanyRole } from "@/lib/db/enums";

const ACTIONS: Action[] = [
  "team:read", "team:create", "team:update", "team:delete", "team:manage_members",
  "project:read", "project:create", "project:update", "project:delete", "project:assign_pm", "project:manage_members",
  "task:read", "task:create", "task:assign", "task:update_status", "task:edit", "task:delete",
  "comment:create", "activity:read_company", "ai:summarize", "ai:breakdown",
];

const as = (role: CompanyRole) => ({ membership: { role } });
const allow = (role: CompanyRole, action: Action, facts: Facts = {}) => can(as(role), action, facts);

// Facts a caller can have towards a project (or a task in it).
const OUTSIDER: Facts = {};
const PROJECT_MEMBER: Facts = { isProjectMember: true };
const TEAM_MEMBER: Facts = { isTeamMember: true };
const THE_PM: Facts = { isProjectManager: true, isProjectMember: true };
const ASSIGNEE: Facts = { isProjectMember: true, isAssignee: true };

describe("can()", () => {
  it.each(["CEO", "TECH_LEAD"] as const)("%s may do everything in the company, whatever the facts", role => {
    for (const action of ACTIONS) expect(allow(role, action, OUTSIDER), action).toBe(true);
  });

  it("everyone may read teams; nobody below leadership creates or deletes them", () => {
    for (const role of ["PROJECT_MANAGER", "TEAM_LEAD", "MEMBER", "VIEWER"] as const) {
      expect(allow(role, "team:read")).toBe(true);
      expect(allow(role, "team:create", TEAM_MEMBER)).toBe(false);
      expect(allow(role, "team:delete", TEAM_MEMBER)).toBe(false);
      expect(allow(role, "activity:read_company")).toBe(false);
    }
  });

  it("a team lead manages their own team only", () => {
    expect(allow("TEAM_LEAD", "team:manage_members", TEAM_MEMBER)).toBe(true);
    expect(allow("TEAM_LEAD", "team:manage_members", OUTSIDER)).toBe(false);
    expect(allow("MEMBER", "team:manage_members", TEAM_MEMBER)).toBe(false);
  });

  describe("project visibility", () => {
    it.each(["PROJECT_MANAGER", "TEAM_LEAD", "MEMBER", "VIEWER"] as const)("%s sees a project only through a relationship to it", role => {
      expect(allow(role, "project:read", OUTSIDER)).toBe(false);
      expect(allow(role, "project:read", PROJECT_MEMBER)).toBe(true);
      expect(allow(role, "project:read", TEAM_MEMBER)).toBe(true);
      expect(allow(role, "task:read", OUTSIDER)).toBe(false);
    });
  });

  describe("running a project", () => {
    const runs: Action[] = ["project:update", "project:manage_members", "task:create", "task:assign", "ai:breakdown"];

    it("the project's own PM runs it; a PM on another project does not", () => {
      for (const a of runs) {
        expect(allow("PROJECT_MANAGER", a, THE_PM), a).toBe(true);
        expect(allow("PROJECT_MANAGER", a, PROJECT_MEMBER), a).toBe(false);
        // Being on the team is not enough for a PM; they must manage this project.
        expect(allow("PROJECT_MANAGER", a, TEAM_MEMBER), a).toBe(false);
      }
    });

    it("a team lead runs the projects of their team", () => {
      for (const a of runs) {
        expect(allow("TEAM_LEAD", a, TEAM_MEMBER), a).toBe(true);
        expect(allow("TEAM_LEAD", a, PROJECT_MEMBER), a).toBe(false);
      }
    });

    it("members and viewers never run a project, even when assigned", () => {
      for (const role of ["MEMBER", "VIEWER"] as const) for (const a of runs) expect(allow(role, a, ASSIGNEE), `${role} ${a}`).toBe(false);
    });

    it("only leadership and the project's PM delete tasks", () => {
      expect(allow("PROJECT_MANAGER", "task:delete", THE_PM)).toBe(true);
      expect(allow("TEAM_LEAD", "task:delete", TEAM_MEMBER)).toBe(false);
      expect(allow("MEMBER", "task:delete", ASSIGNEE)).toBe(false);
    });
  });

  describe("working on a task", () => {
    it("a member may move and edit a task assigned to them, and nothing else", () => {
      expect(allow("MEMBER", "task:update_status", ASSIGNEE)).toBe(true);
      expect(allow("MEMBER", "task:edit", ASSIGNEE)).toBe(true);
      expect(allow("MEMBER", "task:update_status", PROJECT_MEMBER)).toBe(false);
      expect(allow("MEMBER", "task:edit", PROJECT_MEMBER)).toBe(false);
    });

    it("a viewer can never change a task or comment, even if assigned", () => {
      expect(allow("VIEWER", "task:update_status", ASSIGNEE)).toBe(false);
      expect(allow("VIEWER", "task:edit", ASSIGNEE)).toBe(false);
      expect(allow("VIEWER", "comment:create", ASSIGNEE)).toBe(false);
      expect(allow("VIEWER", "task:read", ASSIGNEE)).toBe(true);
    });

    it("anyone else who can see the project may comment", () => {
      expect(allow("MEMBER", "comment:create", PROJECT_MEMBER)).toBe(true);
      expect(allow("MEMBER", "comment:create", OUTSIDER)).toBe(false);
    });
  });

  describe("ai:summarize", () => {
    it("project scope: anyone who can see the project, viewers included", () => {
      expect(allow("VIEWER", "ai:summarize", PROJECT_MEMBER)).toBe(true);
      expect(allow("MEMBER", "ai:summarize", OUTSIDER)).toBe(false);
    });

    it("team scope: members of that team, not a PM who only manages one of its projects", () => {
      expect(allow("MEMBER", "ai:summarize", { isTeamMember: true })).toBe(true);
      expect(allow("PROJECT_MANAGER", "ai:summarize", { isTeamMember: false })).toBe(false);
    });

    it("company scope (no facts): leadership only", () => {
      for (const role of ["PROJECT_MANAGER", "TEAM_LEAD", "MEMBER", "VIEWER"] as const) expect(allow(role, "ai:summarize"), role).toBe(false);
      expect(allow("CEO", "ai:summarize")).toBe(true);
    });
  });

  it("ai:breakdown follows task:create for every role and set of facts", () => {
    const roles: CompanyRole[] = ["CEO", "TECH_LEAD", "PROJECT_MANAGER", "TEAM_LEAD", "MEMBER", "VIEWER"];
    for (const role of roles)
      for (const facts of [OUTSIDER, PROJECT_MEMBER, TEAM_MEMBER, THE_PM, ASSIGNEE])
        expect(allow(role, "ai:breakdown", facts), `${role} ${JSON.stringify(facts)}`).toBe(allow(role, "task:create", facts));
  });
});
