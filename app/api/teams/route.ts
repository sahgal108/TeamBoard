import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { createTeam, listTeams } from "@/services/team.service";
import { createTeamSchema } from "@/validations/team.schema";

export const GET = withAuth(async (_req, ctx) => {
  return NextResponse.json({ data: await listTeams(ctx) });
});

export const POST = withAuth(async (req, ctx) => {
  const input = createTeamSchema.parse(await readJson(req));
  const team = await createTeam(ctx, input);
  return NextResponse.json({ data: team }, { status: 201 });
});
