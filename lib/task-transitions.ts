import type { TaskStatus } from "@/lib/db/enums";

/**
 * Allowed status moves. Shared by the service (authoritative, returns 400 INVALID_TRANSITION)
 * and the board (so an impossible drop is explained before a request is made).
 *
 *   TODO → IN_PROGRESS → IN_REVIEW → DONE
 *   IN_REVIEW → IN_PROGRESS (sent back)      DONE → IN_REVIEW (reopened)
 */
export const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW"],
  IN_REVIEW: ["DONE", "IN_PROGRESS"],
  DONE: ["IN_REVIEW"],
};

export const canTransition = (from: TaskStatus, to: TaskStatus) => TRANSITIONS[from].includes(to);
