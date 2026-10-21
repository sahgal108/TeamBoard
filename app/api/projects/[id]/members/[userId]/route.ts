import { NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { removeProjectMember } from "@/services/project.service";

export const DELETE = withAuth<{ id: string; userId: string }>(async (_req, ctx, { params }) => {
  const { id, userId } = await params;
  await removeProjectMember(ctx, id, userId);
  return new NextResponse(null, { status: 204 });
});
