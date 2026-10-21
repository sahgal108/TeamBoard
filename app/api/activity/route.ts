import { NextResponse } from "next/server";
import { readQuery, withAuth } from "@/lib/with-auth";
import { listActivity } from "@/services/activity.service";
import { activityQuerySchema } from "@/validations/activity.schema";

export const GET = withAuth(async (req, ctx) => {
  const query = activityQuerySchema.parse(readQuery(req));
  return NextResponse.json({ data: await listActivity(ctx, query) });
});
