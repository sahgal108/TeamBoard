import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { deleteTask, getTask, updateTask } from "@/services/task.service";
import { updateTaskSchema } from "@/validations/task.schema";

type P = { id: string };

export const GET = withAuth<P>(async (_req, ctx, { params }) => {
  const { id } = await params;
  return NextResponse.json({ data: await getTask(ctx, id) });
});

export const PATCH = withAuth<P>(async (req, ctx, { params }) => {
  const { id } = await params;
  const input = updateTaskSchema.parse(await readJson(req));
  return NextResponse.json({ data: await updateTask(ctx, id, input) });
});

export const DELETE = withAuth<P>(async (_req, ctx, { params }) => {
  const { id } = await params;
  await deleteTask(ctx, id);
  return new NextResponse(null, { status: 204 });
});
