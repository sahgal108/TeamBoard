import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { createSubtasks } from "@/services/task.service";
import { createSubtasksSchema } from "@/validations/task.schema";

export const POST = withAuth<{ id: string }>(async (req, ctx, { params }) => {
  const { id } = await params;
  const input = createSubtasksSchema.parse(await readJson(req));
  return NextResponse.json({ data: await createSubtasks(ctx, id, input) }, { status: 201 });
});
