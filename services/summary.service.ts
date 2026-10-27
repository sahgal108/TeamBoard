import { Op, type WhereOptions } from "sequelize";
import { z } from "zod";
import { UNTRUSTED_DATA_RULE, untrusted } from "@/lib/ai/provider";
import { generateJson } from "@/lib/ai/usage";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { assertCan } from "@/lib/authorization/assert";
import { authorizeProject } from "@/lib/authorization/project-access";
import { authorizeTeam } from "@/lib/authorization/team-access";
import { TaskPriority, TaskStatus } from "@/lib/db/enums";
import { Activity, Comment, Project, Task, User } from "@/lib/db/models";
import { getOrSet, invalidate } from "@/lib/redis/cache";
import { cacheKeys, cacheTtlSeconds } from "@/lib/redis/keys";

export type SummaryScope = "project" | "team" | "company";
export type SummaryPeriod = "day" | "week";

export type SummaryItem = {
  taskId: string;
  key: string;
  title: string;
  project: string;
  status: TaskStatus;
  assignee: string | null;
  /** One line from the model; falls back to the detected facts when the model gave none. */
  note: string;
};

export type Summary = {
  scope: SummaryScope;
  scopeName: string;
  period: SummaryPeriod;
  since: string;
  generatedAt: string;
  /** null when nothing happened and no model was called. */
  model: string | null;
  headline: string;
  done: SummaryItem[];
  inProgress: SummaryItem[];
  blocked: SummaryItem[];
  stats: { completed: number; inProgress: number; blocked: number; created: number; comments: number };
};

const DAY_MS = 86_400_000;
const LIST_LIMIT = { done: 15, inProgress: 12, blocked: 15 } as const;
/** "Blocked" is not a status here; it is inferred from these signals. */
const STUCK_IN_REVIEW_DAYS = 2;
const URGENT_STALE_DAYS = 3;
const BLOCKER_PATTERNS = ["%blocked%", "%blocker%", "%waiting on%", "%waiting for%", "%stuck%"];

type TaskFact = {
  id: string;
  key: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  project: string;
  due: string | null;
  reasons: string[];
};

const TASK_INCLUDE = [
  { model: Project, as: "project", attributes: ["key", "name"] },
  { model: User, as: "assignee", attributes: ["name"] },
];
const TASK_ATTRIBUTES = ["id", "number", "title", "status", "priority", "dueDate", "updatedAt"];

function toFact(t: Task, reasons: string[] = []): TaskFact {
  return {
    id: t.id,
    key: `${t.project!.key}-${t.number}`,
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee: t.assignee?.name ?? null,
    project: t.project!.name,
    due: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    reasons,
  };
}

const daysSince = (d: Date, now: number) => Math.floor((now - d.getTime()) / DAY_MS);

/**
 * The facts are decided by SQL, not by the model: which tasks were completed, which are in
 * flight, which look blocked and why. The model only writes the wording. So a summary can
 * never contain a task that is not in these lists, whatever the model returns.
 */
async function gatherFacts(companyId: string, projectIds: string[], since: Date) {
  const now = Date.now();
  const scope: WhereOptions = { companyId, projectId: { [Op.in]: projectIds } };
  const notDone = { status: { [Op.ne]: TaskStatus.DONE } };

  const [completedRows, created, comments, inProgressRows, ruleBlockedRows, blockerComments] = await Promise.all([
    Activity.findAll({
      where: { ...scope, action: "TASK_STATUS_CHANGED", createdAt: { [Op.gte]: since }, metadata: { to: TaskStatus.DONE } },
      attributes: ["entityId"],
    }),
    Activity.count({ where: { ...scope, action: "TASK_CREATED", createdAt: { [Op.gte]: since } } }),
    Activity.count({ where: { ...scope, action: "COMMENT_ADDED", createdAt: { [Op.gte]: since } } }),
    Task.findAll({
      where: { ...scope, status: { [Op.in]: [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] } },
      attributes: TASK_ATTRIBUTES,
      include: TASK_INCLUDE,
      order: [["updatedAt", "DESC"]],
    }),
    Task.findAll({
      where: {
        ...scope,
        ...notDone,
        [Op.or]: [
          { dueDate: { [Op.lt]: new Date(now) } },
          { status: TaskStatus.IN_REVIEW, updatedAt: { [Op.lt]: new Date(now - STUCK_IN_REVIEW_DAYS * DAY_MS) } },
          { priority: TaskPriority.URGENT, updatedAt: { [Op.lt]: new Date(now - URGENT_STALE_DAYS * DAY_MS) } },
        ],
      },
      attributes: TASK_ATTRIBUTES,
      include: TASK_INCLUDE,
    }),
    // companyId keeps this inside the tenant; the task query below applies the project scope.
    Comment.findAll({
      where: { companyId, createdAt: { [Op.gte]: since }, [Op.or]: BLOCKER_PATTERNS.map(p => ({ content: { [Op.iLike]: p } })) },
      attributes: ["taskId", "content"],
      order: [["createdAt", "DESC"]],
    }),
  ]);

  const completedIds = [...new Set(completedRows.map(r => r.entityId))];
  const commentByTask = new Map<string, string>();
  for (const c of blockerComments) if (!commentByTask.has(c.taskId)) commentByTask.set(c.taskId, c.content);

  const [doneRows, commentBlockedRows] = await Promise.all([
    completedIds.length
      ? Task.findAll({ where: { ...scope, id: { [Op.in]: completedIds }, status: TaskStatus.DONE }, attributes: TASK_ATTRIBUTES, include: TASK_INCLUDE, order: [["updatedAt", "DESC"]] })
      : Promise.resolve([]),
    commentByTask.size
      ? Task.findAll({ where: { ...scope, ...notDone, id: { [Op.in]: [...commentByTask.keys()] } }, attributes: TASK_ATTRIBUTES, include: TASK_INCLUDE })
      : Promise.resolve([]),
  ]);

  const blocked = new Map<string, TaskFact>();
  for (const t of [...ruleBlockedRows, ...commentBlockedRows]) {
    if (blocked.has(t.id)) continue;
    const reasons: string[] = [];
    if (t.dueDate && t.dueDate.getTime() < now) reasons.push(`overdue since ${t.dueDate.toISOString().slice(0, 10)}`);
    const idle = daysSince(t.updatedAt, now);
    if (t.status === TaskStatus.IN_REVIEW && idle >= STUCK_IN_REVIEW_DAYS) reasons.push(`in review with no change for ${idle} days`);
    if (t.priority === TaskPriority.URGENT && idle >= URGENT_STALE_DAYS) reasons.push(`urgent with no change for ${idle} days`);
    const comment = commentByTask.get(t.id);
    if (comment) reasons.push(`recent comment: "${comment.slice(0, 160)}"`);
    if (reasons.length) blocked.set(t.id, toFact(t, reasons));
  }

  // A blocked task is reported once, under blocked.
  const inFlight = inProgressRows.filter(t => !blocked.has(t.id));
  return {
    done: doneRows.slice(0, LIST_LIMIT.done).map(t => toFact(t)),
    inProgress: inFlight.slice(0, LIST_LIMIT.inProgress).map(t => toFact(t)),
    blocked: [...blocked.values()].slice(0, LIST_LIMIT.blocked),
    stats: { completed: doneRows.length, inProgress: inFlight.length, blocked: blocked.size, created, comments },
  };
}

const noteSchema = z.object({ key: z.string().max(24), note: z.string().max(300) });
const modelReplySchema = z.object({
  headline: z.string().min(1).max(500),
  done: z.array(noteSchema).max(40),
  inProgress: z.array(noteSchema).max(40),
  blocked: z.array(noteSchema).max(40),
});

const SYSTEM_PROMPT = [
  "You write short standup summaries for a project-management app.",
  "You receive three lists of tasks: done, inProgress and blocked. They are already correct; do not add, drop or move tasks.",
  "Return a headline of one or two sentences about the period overall, and for each task a note of at most 20 words.",
  "For done: what was finished. For inProgress: where it stands and who has it. For blocked: why it looks blocked, using the given reasons.",
  "Use the task key exactly as given. Never invent people, dates, numbers or tasks. Plain English, no markdown, no emoji.",
  UNTRUSTED_DATA_RULE,
].join("\n");

/** What the model sees: the minimum needed to write notes. Ids stay server-side. */
const forModel = (facts: TaskFact[], multiProject: boolean) =>
  facts.map(f => ({ key: f.key, title: f.title, status: f.status, priority: f.priority, assignee: f.assignee, due: f.due, ...(multiProject ? { project: f.project } : {}), ...(f.reasons.length ? { reasons: f.reasons } : {}) }));

function toItems(facts: TaskFact[], notes: { key: string; note: string }[], fallback: (f: TaskFact) => string): SummaryItem[] {
  const byKey = new Map(notes.map(n => [n.key.trim().toUpperCase(), n.note.trim()]));
  return facts.map(f => ({
    taskId: f.id,
    key: f.key,
    title: f.title,
    project: f.project,
    status: f.status,
    assignee: f.assignee,
    note: byKey.get(f.key) || fallback(f),
  }));
}

async function buildSummary(
  ctx: CompanyContext,
  target: { scope: SummaryScope; scopeName: string; projectIds: string[] },
  period: SummaryPeriod,
): Promise<Summary> {
  const since = new Date(Date.now() - (period === "day" ? 1 : 7) * DAY_MS);
  const facts = await gatherFacts(ctx.company.id, target.projectIds, since);
  const base = { scope: target.scope, scopeName: target.scopeName, period, since: since.toISOString(), stats: facts.stats };

  const nothing = !facts.done.length && !facts.inProgress.length && !facts.blocked.length && !facts.stats.created && !facts.stats.comments;
  if (nothing) {
    return { ...base, generatedAt: new Date().toISOString(), model: null, headline: "Nothing happened in this period.", done: [], inProgress: [], blocked: [] };
  }

  const multiProject = target.projectIds.length > 1;
  const prompt = [
    `Summarise the ${period === "day" ? "last 24 hours" : "last 7 days"} for ${target.scope} "${target.scopeName}".`,
    `Counts: ${facts.stats.completed} completed, ${facts.stats.created} created, ${facts.stats.comments} comments, ${facts.stats.inProgress} in progress, ${facts.stats.blocked} look blocked.`,
    untrusted("done", forModel(facts.done, multiProject)),
    untrusted("inProgress", forModel(facts.inProgress, multiProject)),
    untrusted("blocked", forModel(facts.blocked, multiProject)),
  ].join("\n\n");

  const { value, model } = await generateJson(ctx, { feature: "summary", system: SYSTEM_PROMPT, prompt, schema: modelReplySchema });

  return {
    ...base,
    generatedAt: new Date().toISOString(),
    model,
    headline: value.headline.trim(),
    done: toItems(facts.done, value.done, () => "Completed."),
    inProgress: toItems(facts.inProgress, value.inProgress, f => (f.assignee ? `With ${f.assignee}.` : "Unassigned.")),
    blocked: toItems(facts.blocked, value.blocked, f => f.reasons.join("; ")),
  };
}

/**
 * Cached per scope and period, shared by everyone allowed to read it: `ai:summarize` only
 * lets in people who can see every project in the scope, so the cached facts are the same
 * for all of them. `refresh` drops the cached copy and generates a new one (rate-limited).
 */
async function cached(key: string, period: SummaryPeriod, refresh: boolean, build: () => Promise<Summary>) {
  if (refresh) await invalidate(key);
  const ttl = period === "day" ? cacheTtlSeconds.aiSummaryDay : cacheTtlSeconds.aiSummaryWeek;
  const { value, hit } = await getOrSet(key, ttl, build);
  return { summary: value, cacheHit: hit };
}

export async function getProjectSummary(ctx: CompanyContext, projectId: string, period: SummaryPeriod, refresh = false) {
  const { project } = await authorizeProject(ctx, projectId, "ai:summarize");
  return cached(cacheKeys.aiSummary("project", project.id, period), period, refresh, () =>
    buildSummary(ctx, { scope: "project", scopeName: project.name, projectIds: [project.id] }, period),
  );
}

export async function getTeamSummary(ctx: CompanyContext, teamId: string, period: SummaryPeriod, refresh = false) {
  const { team } = await authorizeTeam(ctx, teamId, "ai:summarize");
  return cached(cacheKeys.aiSummary("team", team.id, period), period, refresh, async () => {
    const projects = await Project.findAll({ where: { companyId: ctx.company.id, teamId: team.id }, attributes: ["id"] });
    return buildSummary(ctx, { scope: "team", scopeName: team.name, projectIds: projects.map(p => p.id) }, period);
  });
}

export async function getCompanySummary(ctx: CompanyContext, period: SummaryPeriod, refresh = false) {
  assertCan(ctx, "ai:summarize");
  return cached(cacheKeys.aiSummary("company", ctx.company.id, period), period, refresh, async () => {
    const projects = await Project.findAll({ where: { companyId: ctx.company.id }, attributes: ["id"] });
    return buildSummary(ctx, { scope: "company", scopeName: ctx.company.name, projectIds: projects.map(p => p.id) }, period);
  });
}
