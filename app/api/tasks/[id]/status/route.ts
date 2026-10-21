import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { changeTaskStatus } from "@/services/task.service";
import { taskStatusChangeSchema } from "@/validations/task.schema";

export const PATCH = withAuth<{ id: string }>(async (req, ctx, { params }) => {
  const { id } = await params;
  const { status } = taskStatusChangeSchema.parse(await readJson(req));
  return NextResponse.json({ data: await changeTaskStatus(ctx, id, status) });
});
