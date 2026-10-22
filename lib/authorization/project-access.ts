import type { Action, Facts } from "@/lib/auth/permissions";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import type { ProjectStatus } from "@/lib/db/enums";
import { Project, ProjectMember, TeamMember } from "@/lib/db/models";
import { NotFoundError } from "@/lib/errors";
import { assertCan } from "./assert";

export type LoadedProject = {
  id: string;
  companyId: string;
  teamId: string;
  name: string;
  key: string;
  status: ProjectStatus;
  projectManagerId: string | null;
};

export const PROJECT_ATTRIBUTES = ["id", "companyId", "teamId", "name", "key", "status", "projectManagerId"] as const;

export const toLoadedProject = (p: Project): LoadedProject => ({
  id: p.id,
  companyId: p.companyId,
  teamId: p.teamId,
  name: p.name,
  key: p.key,
  status: p.status,
  projectManagerId: p.projectManagerId,
});

/** Tenant-scoped load. The companyId filter is inside the query, never compared afterwards. */
export async function loadProjectOrThrow(ctx: CompanyContext, projectId: string): Promise<LoadedProject> {
  const project = await Project.findOne({ where: { id: projectId, companyId: ctx.company.id }, attributes: [...PROJECT_ATTRIBUTES] });
  if (!project) throw new NotFoundError("Project");
  return toLoadedProject(project);
}

/** Both membership facts in parallel. */
export async function projectFacts(ctx: CompanyContext, project: Pick<LoadedProject, "id" | "teamId" | "projectManagerId">): Promise<Facts> {
  const userId = ctx.user.id;
  const [teamMember, projectMember] = await Promise.all([
    TeamMember.findOne({ where: { teamId: project.teamId, userId }, attributes: ["id"] }),
    ProjectMember.findOne({ where: { projectId: project.id, userId }, attributes: ["id"] }),
  ]);
  return {
    isProjectManager: project.projectManagerId === userId,
    isTeamMember: teamMember !== null,
    isProjectMember: projectMember !== null,
  };
}

/**
 * Steps 3–5 of the pipeline for a project. Visibility is checked first: a project the caller
 * cannot see is a 404 for every action, so existence never leaks through a 403.
 */
export async function authorizeProject(ctx: CompanyContext, projectId: string, action: Action) {
  const project = await loadProjectOrThrow(ctx, projectId);
  const facts = await projectFacts(ctx, project);
  assertCan(ctx, "project:read", facts);
  if (action !== "project:read") assertCan(ctx, action, facts);
  return { project, facts };
}
