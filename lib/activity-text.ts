import type { ActivityItem } from "@/services/activity.service";
import { TASK_STATUS_LABEL } from "./labels";
import type { TaskStatus } from "@/generated/prisma/enums";

export type ActivitySentence = { verb: string; object: string; extra?: string; href?: string };

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const statusLabel = (v: unknown) => (typeof v === "string" && v in TASK_STATUS_LABEL ? TASK_STATUS_LABEL[v as TaskStatus] : str(v));

/** Turns an audit row into "verb + object" for the feed. The actor is rendered by the caller. */
export function describeActivity(a: ActivityItem): ActivitySentence {
  const m = a.metadata ?? {};
  const taskName = [str(m.key), str(m.title)].filter(Boolean).join(" ");
  const taskHref = a.entityType === "TASK" ? `/tasks/${a.entityId}` : undefined;
  const projectHref = a.projectId ? `/projects/${a.projectId}` : undefined;
  const teamHref = a.teamId ? `/teams/${a.teamId}` : undefined;

  switch (a.action) {
    case "TASK_CREATED":
      return { verb: "created", object: taskName, extra: str(m.assigneeName) ? `and assigned it to ${m.assigneeName}` : undefined, href: taskHref };
    case "TASK_UPDATED":
      return { verb: "edited", object: taskName, href: taskHref };
    case "TASK_ASSIGNED":
      return { verb: str(m.toName) ? "assigned" : "unassigned", object: taskName, extra: str(m.toName) ? `to ${m.toName}` : undefined, href: taskHref };
    case "TASK_STATUS_CHANGED":
      return { verb: "moved", object: taskName, extra: `from ${statusLabel(m.from)} to ${statusLabel(m.to)}`, href: taskHref };
    case "TASK_DELETED":
      return { verb: "deleted", object: taskName };
    case "COMMENT_ADDED":
      return { verb: "commented on", object: taskName, href: taskHref };
    case "PROJECT_CREATED":
      return { verb: "created project", object: str(m.name) ?? "", extra: str(m.team) ? `in ${m.team}` : undefined, href: projectHref };
    case "PROJECT_UPDATED":
      return { verb: "updated project", object: str(m.name) ?? "", extra: str(m.status) ? `status ${String(m.status).toLowerCase()}` : undefined, href: projectHref };
    case "PROJECT_DELETED":
      return { verb: "deleted project", object: str(m.name) ?? "" };
    case "PROJECT_MANAGER_CHANGED":
      return { verb: str(m.toName) ? "made" : "removed the project manager of", object: str(m.toName) ? `${m.toName}` : (str(m.name) ?? ""), extra: str(m.toName) ? `project manager of ${m.name}` : undefined, href: projectHref };
    case "PROJECT_MEMBER_ADDED":
      return { verb: "added", object: str(m.userName) ?? "someone", extra: `to ${m.name}`, href: projectHref };
    case "PROJECT_MEMBER_REMOVED":
      return { verb: "removed", object: str(m.userName) ?? "someone", extra: `from ${m.name}`, href: projectHref };
    case "TEAM_CREATED":
      return { verb: "created team", object: str(m.name) ?? "", href: teamHref };
    case "TEAM_UPDATED":
      return { verb: "updated team", object: str(m.name) ?? "", href: teamHref };
    case "TEAM_DELETED":
      return { verb: "deleted team", object: str(m.name) ?? "" };
    case "TEAM_MEMBER_ADDED":
      return { verb: "added", object: str(m.userName) ?? "someone", extra: `to ${m.team}`, href: teamHref };
    case "TEAM_MEMBER_REMOVED":
      return { verb: "removed", object: str(m.userName) ?? "someone", extra: `from ${m.team}`, href: teamHref };
    default:
      return { verb: String(a.action).toLowerCase().replace(/_/g, " "), object: "" };
  }
}
