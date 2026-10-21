import { NextResponse } from "next/server";
import { readJson, readQuery, withAuth } from "@/lib/with-auth";
import { createProject, listProjects } from "@/services/project.service";
import { createProjectSchema, projectListQuerySchema } from "@/validations/project.schema";

export const GET = withAuth(async (req, ctx) => {
  const filter = projectListQuerySchema.parse(readQuery(req));
  return NextResponse.json({ data: await listProjects(ctx, filter) });
});

export const POST = withAuth(async (req, ctx) => {
  const input = createProjectSchema.parse(await readJson(req));
  const project = await createProject(ctx, input);
  return NextResponse.json({ data: project }, { status: 201 });
});
