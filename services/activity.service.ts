import type { Prisma } from "@/generated/prisma/client";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { visibleActivityWhere } from "@/lib/authorization/visibility";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import type { ActivityQuery } from "@/validations/activity.schema";

export type ActivityAction =
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "TEAM_DELETED"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_DELETED"
  | "PROJECT_MANAGER_CHANGED"
  | "PROJECT_MEMBER_ADDED"
  | "PROJECT_MEMBER_REMOVED"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_ASSIGNED"
  | "TASK_STATUS_CHANGED"
  | "TASK_DELETED"
  | "COMMENT_ADDED";

export type ActivityEntityType = "TEAM" | "PROJECT" | "TASK" | "COMMENT";

export type ActivityInput = {
  companyId: string;
  userId: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: ActivityAction;
  metadata?: Prisma.InputJsonValue;
  projectId?: string | null;
  teamId?: string | null;
};

/**
 * The one place Activity rows are written. Takes the transaction client so the audit row
 * commits or rolls back together with the mutation it describes.
 */
export function recordActivity(tx: Prisma.TransactionClient, input: ActivityInput) {
  return tx.activity.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadata: input.metadata,
      projectId: input.projectId ?? null,
      teamId: input.teamId ?? null,
    },
  });
}

export type ActivityItem = {
  id: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  metadata: Record<string, unknown> | null;
  projectId: string | null;
  teamId: string | null;
  createdAt: string;
  actor: { id: string; name: string };
  project: { id: string; name: string; key: string } | null;
};

export type ActivityPage = { items: ActivityItem[]; nextCursor: string | null };

type Cursor = { createdAt: string; id: string };
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString()) as Partial<Cursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    if (Number.isNaN(Date.parse(parsed.createdAt))) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

/**
 * Newest first, keyset-paginated on (createdAt, id). Visibility is applied in SQL via
 * visibleActivityWhere: leadership sees the company, everyone else their projects, teams
 * and own actions.
 */
export async function listActivity(ctx: CompanyContext, query: ActivityQuery): Promise<ActivityPage> {
  const where: Prisma.ActivityWhereInput = { AND: [visibleActivityWhere(ctx)] };
  const and = where.AND as Prisma.ActivityWhereInput[];

  if (query.projectId) {
    // Filtering by a project the caller cannot see must look like the project does not exist.
    const project = await prisma.project.findFirst({ where: { id: query.projectId, companyId: ctx.company.id }, select: { id: true } });
    if (!project) throw new NotFoundError("Project");
    and.push({ projectId: query.projectId });
  }
  if (query.teamId) and.push({ teamId: query.teamId });

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    const at = new Date(cursor.createdAt);
    and.push({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: cursor.id } }] });
  }

  const rows = await prisma.activity.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      projectId: true,
      teamId: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, key: true } },
    },
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(r => ({
      id: r.id,
      action: r.action as ActivityAction,
      entityType: r.entityType as ActivityEntityType,
      entityId: r.entityId,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      projectId: r.projectId,
      teamId: r.teamId,
      createdAt: r.createdAt.toISOString(),
      actor: r.user,
      project: r.project,
    })),
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null,
  };
}

/** Per-entity trail (task drawer, project activity tab). Caller must have authorized the entity. */
export async function listEntityActivity(ctx: CompanyContext, entityType: ActivityEntityType, entityId: string, limit = 50): Promise<ActivityItem[]> {
  const rows = await prisma.activity.findMany({
    where: { companyId: ctx.company.id, entityType, entityId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true, action: true, entityType: true, entityId: true, metadata: true, projectId: true, teamId: true, createdAt: true,
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, key: true } },
    },
  });
  return rows.map(r => ({
    id: r.id,
    action: r.action as ActivityAction,
    entityType: r.entityType as ActivityEntityType,
    entityId: r.entityId,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    projectId: r.projectId,
    teamId: r.teamId,
    createdAt: r.createdAt.toISOString(),
    actor: r.user,
    project: r.project,
  }));
}
