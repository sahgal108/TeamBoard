import { NextResponse } from "next/server";
import { readQuery, withAuth } from "@/lib/with-auth";
import { search } from "@/services/search.service";
import { searchQuerySchema } from "@/validations/activity.schema";

export const GET = withAuth(async (req, ctx) => {
  const { q } = searchQuerySchema.parse(readQuery(req));
  return NextResponse.json({ data: await search(ctx, q) });
});
