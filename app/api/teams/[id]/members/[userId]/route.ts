import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { removeTeamMember } from "@/services/team.service";

export const DELETE = withAuth<{ id: string; userId: string }>(async (_req, ctx, { params }) => {
  const { id, userId } = await params;
  await removeTeamMember(ctx, id, userId);
  return new NextResponse(null, { status: 204 });
});
