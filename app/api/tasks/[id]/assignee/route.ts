import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { assignTask } from "@/services/task.service";
import { taskAssigneeSchema } from "@/validations/task.schema";

export const PATCH = withAuth<{ id: string }>(async (req, ctx, { params }) => {
  const { id } = await params;
  const { assigneeId } = taskAssigneeSchema.parse(await readJson(req));
  return NextResponse.json({ data: await assignTask(ctx, id, assigneeId) });
});
