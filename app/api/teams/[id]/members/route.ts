import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { addTeamMember } from "@/services/team.service";
import { teamMemberSchema } from "@/validations/team.schema";

export const POST = withAuth<{ id: string }>(async (req, ctx, { params }) => {
  const { id } = await params;
  const { userId } = teamMemberSchema.parse(await readJson(req));
  const user = await addTeamMember(ctx, id, userId);
  return NextResponse.json({ data: user }, { status: 201 });
});
