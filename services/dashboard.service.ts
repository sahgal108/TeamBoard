import type { CompanyContext } from "@/lib/auth/get-company-context";
import { hasFullAccess } from "@/lib/auth/permissions";
import { visibleProjectWhere, visibleTaskWhere } from "@/lib/authorization/visibility";
import { prisma } from "@/lib/db/prisma";
import { getOrSet } from "@/lib/redis/cache";
import { cacheKeys, cacheTtlSeconds } from "@/lib/redis/keys";
import { listActivity, type ActivityItem } from "./activity.service";
import { listProjects, type ProjectListItem } from "./project.service";

export type DashboardStats = {
  teams: number;
  projects: number;
  activeProjects: number;
  plannedProjects: number;
  tasks: number;
  done: number;
  inReview: number;
  urgentOpen: number;
  myOpenTasks: number;
};

export type Dashboard = {
  scope: "company" | "mine";
  stats: DashboardStats;
  projects: ProjectListItem[];
  activity: ActivityItem[];
  cacheHit: boolean;
};

/** Company-wide counts: identical for every leader, so cached under one key per company. */
async function companyStats(companyId: string): Promise<Omit<DashboardStats, "myOpenTasks">> {
  const [teams, projects, activeProjects, plannedProjects, tasks, done, inReview, urgentOpen] = await Promise.all([
    prisma.team.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId, status: "ACTIVE" } }),
    prisma.project.count({ where: { companyId, status: "PLANNED" } }),
    prisma.task.count({ where: { companyId } }),
    prisma.task.count({ where: { companyId, status: "DONE" } }),
    prisma.task.count({ where: { companyId, status: "IN_REVIEW" } }),
    prisma.task.count({ where: { companyId, priority: "URGENT", status: { not: "DONE" } } }),
  ]);
  return { teams, projects, activeProjects, plannedProjects, tasks, done, inReview, urgentOpen };
}

/** Scoped roles: counts over what the caller can see. Role-dependent, so never cached. */
async function scopedStats(ctx: CompanyContext): Promise<Omit<DashboardStats, "myOpenTasks" | "teams">> {
  const pw = visibleProjectWhere(ctx);
  const tw = visibleTaskWhere(ctx);
  const [projects, activeProjects, plannedProjects, tasks, done, inReview, urgentOpen] = await Promise.all([
    prisma.project.count({ where: pw }),
    prisma.project.count({ where: { AND: [pw, { status: "ACTIVE" }] } }),
    prisma.project.count({ where: { AND: [pw, { status: "PLANNED" }] } }),
    prisma.task.count({ where: tw }),
    prisma.task.count({ where: { AND: [tw, { status: "DONE" }] } }),
    prisma.task.count({ where: { AND: [tw, { status: "IN_REVIEW" }] } }),
    prisma.task.count({ where: { AND: [tw, { priority: "URGENT", status: { not: "DONE" } }] } }),
  ]);
  return { projects, activeProjects, plannedProjects, tasks, done, inReview, urgentOpen };
}

export async function getDashboard(ctx: CompanyContext): Promise<Dashboard> {
  const full = hasFullAccess(ctx.membership.role);
  const myOpenTasksP = prisma.task.count({ where: { companyId: ctx.company.id, assigneeId: ctx.user.id, status: { not: "DONE" } } });
  const projectsP = listProjects(ctx);
  const activityP = listActivity(ctx, { limit: 8 });

  if (full) {
    const { value, hit } = await getOrSet(cacheKeys.dashboard(ctx.company.id), cacheTtlSeconds.dashboard, () => companyStats(ctx.company.id));
    const [myOpenTasks, projects, activity] = await Promise.all([myOpenTasksP, projectsP, activityP]);
    return { scope: "company", stats: { ...value, myOpenTasks }, projects, activity: activity.items, cacheHit: hit };
  }

  const [stats, teams, myOpenTasks, projects, activity] = await Promise.all([
    scopedStats(ctx),
    prisma.team.count({ where: { companyId: ctx.company.id, members: { some: { userId: ctx.user.id } } } }),
    myOpenTasksP,
    projectsP,
    activityP,
  ]);
  return { scope: "mine", stats: { ...stats, teams, myOpenTasks }, projects, activity: activity.items, cacheHit: false };
}
