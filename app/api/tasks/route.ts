import { NextResponse } from "next/server";
import { readJson, readQuery, withAuth } from "@/lib/with-auth";
import { createTask, listTasks } from "@/services/task.service";
import { createTaskSchema, taskListQuerySchema } from "@/validations/task.schema";

export const GET = withAuth(async (req, ctx) => {
  const query = taskListQuerySchema.parse(readQuery(req));
  return NextResponse.json({ data: await listTasks(ctx, query) });
});

export const POST = withAuth(async (req, ctx) => {
  const input = createTaskSchema.parse(await readJson(req));
  const task = await createTask(ctx, input);
  return NextResponse.json({ data: task }, { status: 201 });
});
