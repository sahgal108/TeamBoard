import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { addComment, listComments } from "@/services/task.service";
import { createCommentSchema } from "@/validations/task.schema";

type P = { id: string };

export const GET = withAuth<P>(async (_req, ctx, { params }) => {
  const { id } = await params;
  return NextResponse.json({ data: await listComments(ctx, id) });
});

export const POST = withAuth<P>(async (req, ctx, { params }) => {
  const { id } = await params;
  const input = createCommentSchema.parse(await readJson(req));
  return NextResponse.json({ data: await addComment(ctx, id, input) }, { status: 201 });
});
