import { Op, type Transaction, type WhereOptions } from "sequelize";
import type { CompanyContext } from "@/lib/auth/get-company-context";
import { visibleActivityWhere } from "@/lib/authorization/visibility";
import { Activity, Project, User } from "@/lib/db/models";
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
  metadata?: Record<string, unknown>;
  projectId?: string | null;
  teamId?: string | null;
};

/**
 * The one place Activity rows are written. Takes the transaction so the audit row
 * commits or rolls back together with the mutation it describes.
 */
export function recordActivity(transaction: Transaction, input: ActivityInput) {
  return Activity.create(
    {
      companyId: input.companyId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      // JSON round trip drops undefined values, as the old JSON column writer did.
      metadata: input.metadata === undefined ? null : JSON.parse(JSON.stringify(input.metadata)),
      projectId: input.projectId ?? null,
      teamId: input.teamId ?? null,
    },
    { transaction },
  );
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

const ITEM_ATTRIBUTES = ["id", "action", "entityType", "entityId", "metadata", "projectId", "teamId", "createdAt"];
const ITEM_INCLUDE = [
  { model: User, as: "user", attributes: ["id", "name"] },
  { model: Project, as: "project", attributes: ["id", "name", "key"] },
];

const toItem = (r: Activity): ActivityItem => ({
  id: r.id,
  action: r.action as ActivityAction,
  entityType: r.entityType as ActivityEntityType,
  entityId: r.entityId,
  metadata: r.metadata ?? null,
  projectId: r.projectId,
  teamId: r.teamId,
  createdAt: r.createdAt.toISOString(),
  actor: { id: r.user!.id, name: r.user!.name },
  project: r.project ? { id: r.project.id, name: r.project.name, key: r.project.key } : null,
});

/**
 * Newest first, keyset-paginated on (createdAt, id). Visibility is applied in SQL via
 * visibleActivityWhere: leadership sees the company, everyone else their projects, teams
 * and own actions.
 */
export async function listActivity(ctx: CompanyContext, query: ActivityQuery): Promise<ActivityPage> {
  const and: WhereOptions[] = [visibleActivityWhere(ctx)];

  if (query.projectId) {
    // Filtering by a project the caller cannot see must look like the project does not exist.
    const project = await Project.findOne({ where: { id: query.projectId, companyId: ctx.company.id }, attributes: ["id"] });
    if (!project) throw new NotFoundError("Project");
    and.push({ projectId: query.projectId });
  }
  if (query.teamId) and.push({ teamId: query.teamId });

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    const at = new Date(cursor.createdAt);
    and.push({ [Op.or]: [{ createdAt: { [Op.lt]: at } }, { createdAt: at, id: { [Op.lt]: cursor.id } }] });
  }

  const rows = await Activity.findAll({
    where: { [Op.and]: and },
    attributes: ITEM_ATTRIBUTES,
    include: ITEM_INCLUDE,
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(toItem),
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null,
  };
}

/** Per-entity trail (task drawer, project activity tab). Caller must have authorized the entity. */
export async function listEntityActivity(ctx: CompanyContext, entityType: ActivityEntityType, entityId: string, limit = 50): Promise<ActivityItem[]> {
  const rows = await Activity.findAll({
    where: { companyId: ctx.company.id, entityType, entityId },
    attributes: ITEM_ATTRIBUTES,
    include: ITEM_INCLUDE,
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit,
  });
  return rows.map(toItem);
}
