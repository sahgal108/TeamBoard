import { Op, type WhereOptions } from "sequelize";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { hasFullAccess } from "@/lib/auth/permissions";
import { myTeamsWhere, visibleProjectWhere, visibleTaskWhere } from "@/lib/authorization/visibility";
import { Project, Task, Team } from "@/lib/db/models";
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

const both = (a: WhereOptions, b: WhereOptions): WhereOptions => ({ [Op.and]: [a, b] });
const openUrgent: WhereOptions = { priority: "URGENT", status: { [Op.ne]: "DONE" } };

/** Counts over a project scope and a task scope; shared by the company and the scoped view. */
async function countStats(pw: WhereOptions, tw: WhereOptions) {
  const [projects, activeProjects, plannedProjects, tasks, done, inReview, urgentOpen] = await Promise.all([
    Project.count({ where: pw }),
    Project.count({ where: both(pw, { status: "ACTIVE" }) }),
    Project.count({ where: both(pw, { status: "PLANNED" }) }),
    Task.count({ where: tw }),
    Task.count({ where: both(tw, { status: "DONE" }) }),
    Task.count({ where: both(tw, { status: "IN_REVIEW" }) }),
    Task.count({ where: both(tw, openUrgent) }),
  ]);
  return { projects, activeProjects, plannedProjects, tasks, done, inReview, urgentOpen };
}

/** Company-wide counts: identical for every leader, so cached under one key per company. */
async function companyStats(companyId: string): Promise<Omit<DashboardStats, "myOpenTasks">> {
  const [teams, rest] = await Promise.all([Team.count({ where: { companyId } }), countStats({ companyId }, { companyId })]);
  return { teams, ...rest };
}

/** Scoped roles: counts over what the caller can see. Role-dependent, so never cached. */
function scopedStats(ctx: CompanyContext): Promise<Omit<DashboardStats, "myOpenTasks" | "teams">> {
  return countStats(visibleProjectWhere(ctx), visibleTaskWhere(ctx));
}

export async function getDashboard(ctx: CompanyContext): Promise<Dashboard> {
  const full = hasFullAccess(ctx.membership.role);
  const myOpenTasksP = Task.count({ where: { companyId: ctx.company.id, assigneeId: ctx.user.id, status: { [Op.ne]: "DONE" } } });
  const projectsP = listProjects(ctx);
  const activityP = listActivity(ctx, { limit: 8 });

  if (full) {
    const { value, hit } = await getOrSet(cacheKeys.dashboard(ctx.company.id), cacheTtlSeconds.dashboard, () => companyStats(ctx.company.id));
    const [myOpenTasks, projects, activity] = await Promise.all([myOpenTasksP, projectsP, activityP]);
    return { scope: "company", stats: { ...value, myOpenTasks }, projects, activity: activity.items, cacheHit: hit };
  }

  const [stats, teams, myOpenTasks, projects, activity] = await Promise.all([
    scopedStats(ctx),
    Team.count({ where: myTeamsWhere(ctx) }),
    myOpenTasksP,
    projectsP,
    activityP,
  ]);
  return { scope: "mine", stats: { ...stats, teams, myOpenTasks }, projects, activity: activity.items, cacheHit: false };
}
