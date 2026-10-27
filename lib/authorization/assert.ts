import { can, type Action, type Facts, type PolicyContext } from "@/lib/auth/permissions";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const MESSAGES: Partial<Record<Action, string>> = {
  "team:create": "Only company leadership can create teams",
  "team:delete": "Only company leadership can delete teams",
  "team:update": "Only company leadership or this team's lead can edit the team",
  "team:manage_members": "Only company leadership or this team's lead can change its members",
  "project:create": "Only company leadership can create projects",
  "project:assign_pm": "Only company leadership can assign a project manager",
  "project:delete": "Only company leadership can delete projects",
  "project:update": "Only the project manager, the team lead or company leadership can edit this project",
  "project:manage_members": "Only the project manager, the team lead or company leadership can change project members",
  "task:create": "Only the project manager, the team lead or company leadership can create tasks here",
  "task:assign": "Only the project manager, the team lead or company leadership can assign tasks",
  "task:update_status": "Only the assignee or someone who runs this project can change the status",
  "task:edit": "Only the assignee or someone who runs this project can edit this task",
  "task:delete": "Only the project manager or company leadership can delete tasks",
  "comment:create": "Viewers cannot comment",
  "activity:read_company": "Company-wide activity is only available to leadership",
  "ai:summarize": "Summaries are available to people who can see all of what they cover",
};

/**
 * Step 5 of the mutation pipeline: policy says no → 403 with a human explanation.
 *
 * Exception: a *read* the caller is not allowed is answered with 404, not 403. A project or
 * task the caller cannot see should look exactly like one that does not exist, whether it
 * lives in another company or just outside their scope inside this one.
 */
export function assertCan(ctx: PolicyContext, action: Action, facts: Facts = {}): void {
  if (can(ctx, action, facts)) return;
  if (action === "project:read") throw new NotFoundError("Project");
  if (action === "task:read") throw new NotFoundError("Task");
  throw new ForbiddenError(MESSAGES[action]);
}
