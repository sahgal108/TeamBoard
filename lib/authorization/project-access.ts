import type { ProjectStatus } from "@/generated/prisma/enums";
import type { Action, Facts } from "@/lib/auth/permissions";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { prisma } from "@/lib/db/prisma";
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

const projectSelect = { id: true, companyId: true, teamId: true, name: true, key: true, status: true, projectManagerId: true } as const;

/** Tenant-scoped load. The companyId filter is inside the query, never compared afterwards. */
export async function loadProjectOrThrow(ctx: CompanyContext, projectId: string): Promise<LoadedProject> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: ctx.company.id },
    select: projectSelect,
  });
  if (!project) throw new NotFoundError("Project");
  return project;
}

/** One round trip for both membership facts. */
export async function projectFacts(ctx: CompanyContext, project: Pick<LoadedProject, "id" | "teamId" | "projectManagerId">): Promise<Facts> {
  const userId = ctx.user.id;
  const [teamMember, projectMember] = await Promise.all([
    prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: project.teamId, userId } }, select: { id: true } }),
    prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: project.id, userId } }, select: { id: true } }),
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
