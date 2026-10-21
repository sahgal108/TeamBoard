import { channels } from "@/lib/redis/keys";
import { ensureRedis, redis } from "@/lib/redis/redis";

export type ProjectEvent =
  | { type: "TASK_CREATED"; taskId: string; actorId: string }
  | { type: "TASK_UPDATED"; taskId: string; actorId: string }
  | { type: "TASK_STATUS_CHANGED"; taskId: string; from: string; to: string; actorId: string }
  | { type: "TASK_ASSIGNED"; taskId: string; assigneeId: string | null; actorId: string }
  | { type: "TASK_DELETED"; taskId: string; actorId: string }
  | { type: "COMMENT_ADDED"; taskId: string; commentId: string; actorId: string }
  | { type: "PROJECT_UPDATED"; actorId: string };

/**
 * Fan-out to everyone viewing the project. Fire-and-forget: a failed publish must never fail
 * the mutation that already committed. The realtime server (realtime/server.ts) relays the
 * channel to the Socket.IO room after checking each subscriber's access on join.
 */
export async function publishProjectEvent(projectId: string, event: ProjectEvent): Promise<void> {
  try {
    if (!(await ensureRedis())) return;
    await redis.publish(channels.project(projectId), JSON.stringify({ ...event, projectId, at: new Date().toISOString() }));
  } catch (err) {
    console.warn("[realtime] publish failed", err instanceof Error ? err.message : err);
  }
}
