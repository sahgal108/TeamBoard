import { NextResponse } from "next/server";
import { readJson, withAuth } from "@/lib/with-auth";
import { addProjectMember } from "@/services/project.service";
import { projectMemberSchema } from "@/validations/project.schema";

export const POST = withAuth<{ id: string }>(async (req, ctx, { params }) => {
  const { id } = await params;
  const { userId } = projectMemberSchema.parse(await readJson(req));
  const user = await addProjectMember(ctx, id, userId);
  return NextResponse.json({ data: user }, { status: 201 });
});
