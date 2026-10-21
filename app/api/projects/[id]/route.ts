import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { deleteProject, getProject, updateProject } from "@/services/project.service";
import { updateProjectSchema } from "@/validations/project.schema";

type P = { id: string };

export const GET = withAuth<P>(async (_req, ctx, { params }) => {
  const { id } = await params;
  const { summary, permissions, cacheHit } = await getProject(ctx, id);
  return NextResponse.json({ data: { ...summary, permissions } }, { headers: { "x-cache": cacheHit ? "HIT" : "MISS" } });
});

export const PATCH = withAuth<P>(async (req, ctx, { params }) => {
  const { id } = await params;
  const input = updateProjectSchema.parse(await readJson(req));
  return NextResponse.json({ data: await updateProject(ctx, id, input) });
});

export const DELETE = withAuth<P>(async (_req, ctx, { params }) => {
  const { id } = await params;
  await deleteProject(ctx, id);
  return new NextResponse(null, { status: 204 });
});
