import { NextResponse } from "next/server";
import { readQuery, withAuth } from "@/lib/with-auth";
import { getProjectSummary } from "@/services/summary.service";
import { summaryQuerySchema } from "@/validations/summary.schema";

export const GET = withAuth<{ id: string }>(async (req, ctx, { params }) => {
  const { id } = await params;
  const { period, refresh } = summaryQuerySchema.parse(readQuery(req));
  const { summary, cacheHit } = await getProjectSummary(ctx, id, period, refresh);
  return NextResponse.json({ data: summary }, { headers: { "x-cache": cacheHit ? "HIT" : "MISS" } });
});
