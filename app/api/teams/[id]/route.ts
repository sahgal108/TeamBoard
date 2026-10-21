import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { deleteTeam, getTeam, updateTeam } from "@/services/team.service";
import { updateTeamSchema } from "@/validations/team.schema";

type P = { id: string };

export const GET = withAuth<P>(async (_req, ctx, { params }) => {
  const { id } = await params;
  return NextResponse.json({ data: await getTeam(ctx, id) });
});

export const PATCH = withAuth<P>(async (req, ctx, { params }) => {
  const { id } = await params;
  const input = updateTeamSchema.parse(await readJson(req));
  return NextResponse.json({ data: await updateTeam(ctx, id, input) });
});

export const DELETE = withAuth<P>(async (_req, ctx, { params }) => {
  const { id } = await params;
  await deleteTeam(ctx, id);
  return new NextResponse(null, { status: 204 });
});
