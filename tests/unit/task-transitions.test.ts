import { describe, expect, it } from "vitest";
import type { TaskStatus } from "@/lib/db/enums";
import { canTransition } from "@/lib/task-transitions";

describe("task status transitions", () => {
  it.each<[TaskStatus, TaskStatus]>([
    ["TODO", "IN_PROGRESS"],
    ["IN_PROGRESS", "IN_REVIEW"],
    ["IN_REVIEW", "DONE"],
    ["IN_REVIEW", "IN_PROGRESS"],
    ["DONE", "IN_REVIEW"],
  ])("allows %s → %s", (from, to) => expect(canTransition(from, to)).toBe(true));

  it.each<[TaskStatus, TaskStatus]>([
    ["TODO", "IN_REVIEW"],
    ["TODO", "DONE"],
    ["IN_PROGRESS", "DONE"],
    ["IN_PROGRESS", "TODO"],
    ["DONE", "TODO"],
    ["DONE", "IN_PROGRESS"],
  ])("refuses %s → %s", (from, to) => expect(canTransition(from, to)).toBe(false));
});
